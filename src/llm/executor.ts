import { spawn, type Subprocess } from 'bun';
import type { ExecuteOptions, ExecuteResult, OutputEvent, MessageContext } from './types.js';
import { parseStreamLine, extractFinalResult } from './parser.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('executor');

const DEFAULT_TIMEOUT = 600000; // 10 minutes
const DEFAULT_ALLOWED_TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch'];

/**
 * Build a context string that informs Claude about the conversation source
 */
function buildContextPrompt(ctx: MessageContext): string {
  const lines: string[] = [
    '## Conversation Context',
    '',
    `You are responding to a message from ${ctx.platform === 'slack' ? 'Slack' : 'Microsoft Teams'}.`,
    '',
  ];

  // Location info
  if (ctx.isDM) {
    lines.push(`- **Type**: Direct message`);
  } else {
    const channelDisplay = ctx.channelName ? `#${ctx.channelName}` : ctx.channelId;
    lines.push(`- **Channel**: ${channelDisplay}`);
    if (ctx.isThread) {
      lines.push(`- **Thread**: Yes (responding in thread ${ctx.threadId})`);
    }
  }

  // Workspace info
  const workspaceDisplay = ctx.workspaceName ?? ctx.workspaceId;
  lines.push(`- **Workspace**: ${workspaceDisplay}`);

  // User info
  const userDisplay = ctx.userName ? `${ctx.userName} (${ctx.userId})` : ctx.userId;
  lines.push(`- **From**: ${userDisplay}`);

  // Message formatting guidance
  lines.push('');
  lines.push('### Message Formatting');
  if (ctx.platform === 'slack') {
    lines.push('Format your responses using Slack mrkdwn syntax:');
    lines.push('- Bold: `*bold*`');
    lines.push('- Italic: `_italic_`');
    lines.push('- Strikethrough: `~strike~`');
    lines.push('- Code: `` `code` `` or ` ```code block``` `');
    lines.push('- Links: `<https://example.com|link text>`');
    lines.push('- Lists: Start lines with `•` or `1.`');
    lines.push('- Blockquote: Start lines with `>`');
    lines.push('- Emoji: `:emoji_name:` (e.g., `:white_check_mark:`, `:warning:`, `:rocket:`)');
  } else {
    lines.push('Format your responses using Teams markdown:');
    lines.push('- Bold: `**bold**`');
    lines.push('- Italic: `_italic_`');
    lines.push('- Code: `` `code` `` or ` ```code block``` `');
    lines.push('- Links: `[link text](https://example.com)`');
    lines.push('- Lists: Start lines with `-` or `1.`');
    lines.push('- Blockquote: Start lines with `>`');
  }

  // MCP Tools guidance
  lines.push('');
  lines.push('### Promptty MCP Tools');
  lines.push('');
  lines.push('You have access to these tools for communicating back to chat:');
  lines.push('');
  lines.push('**`post_update`** - Send progress updates to the current conversation');
  lines.push('- Use for long-running tasks to keep users informed');
  lines.push('- Types: `progress`, `warning`, `success`, `error`');
  lines.push('- Example: "Running tests..." or "Deployment complete!"');
  lines.push('');
  lines.push('**`list_channels`** - Discover available channels');
  lines.push('- Call this first if you need to send a message to another channel');
  lines.push('- Returns channel IDs, names, and platform info');
  lines.push('');
  lines.push('**`send_message`** - Send a message to a specific channel');
  lines.push('- Requires: `platform`, `channel_id`, `message`');
  lines.push('- Optional: `thread_ts` (for threading), `workspace_id`');
  lines.push('- Use `list_channels` first to find the correct channel_id');
  lines.push('');
  lines.push('Current conversation IDs (for reference):');
  lines.push(`- Platform: \`${ctx.platform}\``);
  lines.push(`- Channel ID: \`${ctx.channelId}\``);
  lines.push(`- Workspace ID: \`${ctx.workspaceId}\``);
  if (ctx.threadId) {
    lines.push(`- Thread ID: \`${ctx.threadId}\``);
  }
  lines.push('');

  return lines.join('\n');
}

export class ClaudeExecutor {
  private activeProcesses: Map<string, Subprocess> = new Map();

  async execute(prompt: string, options: ExecuteOptions): Promise<ExecuteResult> {
    const startTime = Date.now();
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;

    const args = this.buildArgs(prompt, options);

    logger.info({
      workingDirectory: options.workingDirectory,
      sessionId: options.sessionId,
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
    }, 'Starting Claude Code execution');

    const proc = spawn({
      cmd: ['claude', ...args],
      cwd: options.workingDirectory,
      env: {
        ...process.env,
        PROMPTTY_SESSION_ID: options.sessionId ?? '',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const executionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.activeProcesses.set(executionId, proc);

    const events: OutputEvent[] = [];
    let stderr = '';

    // Set up timeout
    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      setTimeout(() => resolve('timeout'), timeout);
    });

    try {
      // Read stdout line by line
      const reader = proc.stdout.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const readOutput = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const event = parseStreamLine(line);
            if (event) {
              events.push(event);
              if (options.onUpdate) {
                options.onUpdate(event);
              }
            }
          }
        }

        // Process remaining buffer
        if (buffer) {
          const event = parseStreamLine(buffer);
          if (event) {
            events.push(event);
          }
        }
      };

      // Read stderr
      const readStderr = async () => {
        const stderrReader = proc.stderr.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await stderrReader.read();
          if (done) break;
          chunks.push(value);
        }
        stderr = decoder.decode(Buffer.concat(chunks));
      };

      // Race between completion and timeout
      const result = await Promise.race([
        Promise.all([readOutput(), readStderr(), proc.exited]).then(() => 'completed' as const),
        timeoutPromise,
      ]);

      if (result === 'timeout') {
        logger.warn({ executionId }, 'Execution timeout, killing process');
        proc.kill();
        this.activeProcesses.delete(executionId);

        return {
          success: false,
          output: 'Execution timed out',
          error: 'Timeout',
          duration: Date.now() - startTime,
        };
      }

      this.activeProcesses.delete(executionId);

      const exitCode = proc.exitCode;
      const duration = Date.now() - startTime;
      const { output, sessionId, isError } = extractFinalResult(events);

      if (exitCode !== 0 && !isError) {
        logger.error({ exitCode, stderr }, 'Claude Code exited with error');
        return {
          success: false,
          output: stderr || `Process exited with code ${exitCode}`,
          claudeSessionId: sessionId,
          error: stderr,
          duration,
        };
      }

      logger.info({ duration, sessionId, outputLength: output.length }, 'Execution completed');
      return {
        success: !isError,
        output,
        claudeSessionId: sessionId,
        error: isError ? output : undefined,
        duration,
      };

    } catch (error) {
      this.activeProcesses.delete(executionId);
      logger.error({ error }, 'Failed to execute Claude Code');

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  private buildArgs(prompt: string, options: ExecuteOptions): string[] {
    const args: string[] = [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--verbose',
    ];

    // Add resume flag if continuing a session
    if (options.sessionId) {
      args.push('--resume', options.sessionId);
    }

    // Add allowed tools (pre-approved tools)
    const tools = options.allowedTools ?? DEFAULT_ALLOWED_TOOLS;
    if (tools.length > 0) {
      args.push('--allowedTools', tools.join(','));
    }

    // Skip permission prompts (runs without asking for allowed tools)
    if (options.skipPermissions) {
      args.push('--dangerously-skip-permissions');
    }

    // Build combined system prompt with context + custom prompt
    const systemPromptParts: string[] = [];

    if (options.messageContext) {
      systemPromptParts.push(buildContextPrompt(options.messageContext));
    }

    if (options.systemPrompt) {
      systemPromptParts.push(options.systemPrompt);
    }

    if (systemPromptParts.length > 0) {
      args.push('--system-prompt', systemPromptParts.join('\n'));
    }

    return args;
  }

  cancelExecution(executionId: string): boolean {
    const proc = this.activeProcesses.get(executionId);
    if (proc) {
      proc.kill();
      this.activeProcesses.delete(executionId);
      return true;
    }
    return false;
  }

  cancelAll(): void {
    for (const [id, proc] of this.activeProcesses) {
      proc.kill();
      this.activeProcesses.delete(id);
    }
  }
}

// Singleton instance
export const executor = new ClaudeExecutor();
