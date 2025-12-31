import { App, LogLevel } from '@slack/bolt';
import { env } from '../../config/env.js';
import { loadConfig, getChannelConfig } from '../../config/loader.js';
import { getOrCreateSession, updateClaudeSessionId, logMessage } from '../../db/sessions.js';
import { executor } from '../../llm/executor.js';
import { formatAcknowledgement, formatResponse, formatError, formatIntermediateUpdate } from '../../formatters/slack.js';
import { createChildLogger } from '../../utils/logger.js';
import type { OutputEvent } from '../../llm/types.js';

const logger = createChildLogger('slack');

let app: App | null = null;

export interface SlackMessageContext {
  channelId: string;
  threadTs: string;
  workspaceId: string;
  userId: string;
  ackTs?: string;
}

// Store active message contexts for callbacks
const activeContexts = new Map<string, SlackMessageContext>();

export function getActiveContext(sessionId: string): SlackMessageContext | undefined {
  return activeContexts.get(sessionId);
}

export async function initSlackApp(): Promise<App | null> {
  const config = loadConfig();

  // Check for Slack credentials in config or env
  const appToken = config.slack?.appToken ?? env.SLACK_APP_TOKEN;
  const botToken = config.slack?.botToken ?? env.SLACK_BOT_TOKEN;
  const signingSecret = config.slack?.signingSecret ?? env.SLACK_SIGNING_SECRET;

  if (!appToken || !botToken) {
    logger.info('Slack credentials not configured, skipping Slack adapter');
    return null;
  }

  app = new App({
    token: botToken,
    appToken,
    signingSecret,
    socketMode: true,
    logLevel: env.LOG_LEVEL === 'debug' ? LogLevel.DEBUG : LogLevel.INFO,
  });

  // Handle direct messages and mentions
  app.message(async ({ message, client, say }) => {
    // Only handle user messages (not bot messages)
    if (message.subtype || !('text' in message) || !message.text) {
      return;
    }

    const channelId = message.channel;
    const threadTs = ('thread_ts' in message ? message.thread_ts : message.ts) ?? message.ts;
    const workspaceId = (await client.auth.test()).team_id ?? 'unknown';
    const userId = message.user ?? 'unknown';
    const text = message.text;

    logger.info({ channelId, threadTs, userId, textLength: text.length }, 'Received Slack message');

    // Get channel configuration
    const channelConfig = getChannelConfig({
      platform: 'slack',
      workspaceId,
      channelId,
    });

    if (!channelConfig) {
      logger.warn({ channelId, workspaceId }, 'No configuration for this channel');
      await say({
        text: ':warning: This channel is not configured. Please add it to the config.json file.',
        thread_ts: threadTs,
      });
      return;
    }

    // Get or create session
    const session = getOrCreateSession(
      {
        platform: 'slack',
        workspaceId,
        channelId,
        threadId: threadTs,
      },
      channelConfig.sessionTTL
    );

    // Log incoming message
    logMessage(session.id, 'in', text);

    // Send acknowledgement
    const ack = formatAcknowledgement();
    const ackResponse = await say({
      text: ack.text,
      blocks: ack.blocks as never[],
      thread_ts: threadTs,
    });

    const ackTs = ackResponse.ts;

    // Store context for callbacks
    const context: SlackMessageContext = {
      channelId,
      threadTs,
      workspaceId,
      userId,
      ackTs,
    };
    activeContexts.set(session.id, context);

    try {
      // Execute Claude Code
      const result = await executor.execute(text, {
        workingDirectory: channelConfig.workingDirectory,
        sessionId: session.claudeSessionId ?? undefined,
        systemPrompt: channelConfig.systemPrompt,
        allowedTools: channelConfig.allowedTools,
        skipPermissions: channelConfig.skipPermissions,
        onUpdate: (event: OutputEvent) => {
          // Handle streaming updates if desired
          if (event.type === 'system' && event.level === 'info') {
            // Could send progress updates here
          }
        },
      });

      // Update Claude session ID if this was a new session
      if (result.claudeSessionId && result.claudeSessionId !== session.claudeSessionId) {
        updateClaudeSessionId(session.id, result.claudeSessionId);
      }

      // Format and send response
      const response = result.success
        ? formatResponse(result.output, result.duration)
        : formatError(result.error ?? result.output);

      // Update the acknowledgement message with the response
      if (ackTs) {
        await client.chat.update({
          channel: channelId,
          ts: ackTs,
          text: response.text,
          blocks: response.blocks as never[],
        });
      }

      // Log outgoing message
      logMessage(session.id, 'out', result.output, { success: result.success, duration: result.duration });

    } catch (error) {
      logger.error({ error }, 'Error executing Claude Code');

      const errorResponse = formatError(error instanceof Error ? error.message : 'Unknown error');
      if (ackTs) {
        await client.chat.update({
          channel: channelId,
          ts: ackTs,
          text: errorResponse.text,
          blocks: errorResponse.blocks as never[],
        });
      }
    } finally {
      activeContexts.delete(session.id);
    }
  });

  // Handle app_mention events (when bot is @mentioned)
  app.event('app_mention', async ({ event, client, say }) => {
    // Remove the bot mention from the text
    const text = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();

    if (!text) {
      await say({
        text: 'Hi! Send me a message and I\'ll process it with Claude Code.',
        thread_ts: event.ts,
      });
      return;
    }

    // Process like a regular message - create a synthetic message event
    const workspaceId = (await client.auth.test()).team_id ?? 'unknown';

    logger.info({ channelId: event.channel, text: text.substring(0, 50) }, 'Received app mention');

    const channelConfig = getChannelConfig({
      platform: 'slack',
      workspaceId,
      channelId: event.channel,
    });

    if (!channelConfig) {
      await say({
        text: ':warning: This channel is not configured.',
        thread_ts: event.ts,
      });
      return;
    }

    const session = getOrCreateSession(
      {
        platform: 'slack',
        workspaceId,
        channelId: event.channel,
        threadId: event.thread_ts ?? event.ts,
      },
      channelConfig.sessionTTL
    );

    logMessage(session.id, 'in', text);

    const ack = formatAcknowledgement();
    const ackResponse = await say({
      text: ack.text,
      blocks: ack.blocks as never[],
      thread_ts: event.thread_ts ?? event.ts,
    });

    const context: SlackMessageContext = {
      channelId: event.channel,
      threadTs: event.thread_ts ?? event.ts,
      workspaceId,
      userId: event.user,
      ackTs: ackResponse.ts,
    };
    activeContexts.set(session.id, context);

    try {
      const result = await executor.execute(text, {
        workingDirectory: channelConfig.workingDirectory,
        sessionId: session.claudeSessionId ?? undefined,
        systemPrompt: channelConfig.systemPrompt,
        allowedTools: channelConfig.allowedTools,
        skipPermissions: channelConfig.skipPermissions,
      });

      if (result.claudeSessionId && result.claudeSessionId !== session.claudeSessionId) {
        updateClaudeSessionId(session.id, result.claudeSessionId);
      }

      const response = result.success
        ? formatResponse(result.output, result.duration)
        : formatError(result.error ?? result.output);

      if (ackResponse.ts) {
        await client.chat.update({
          channel: event.channel,
          ts: ackResponse.ts,
          text: response.text,
          blocks: response.blocks as never[],
        });
      }

      logMessage(session.id, 'out', result.output, { success: result.success });

    } catch (error) {
      logger.error({ error }, 'Error in app_mention handler');

      if (ackResponse.ts) {
        const errorResponse = formatError(error instanceof Error ? error.message : 'Unknown error');
        await client.chat.update({
          channel: event.channel,
          ts: ackResponse.ts,
          text: errorResponse.text,
          blocks: errorResponse.blocks as never[],
        });
      }
    } finally {
      activeContexts.delete(session.id);
    }
  });

  logger.info('Slack adapter initialized');
  return app;
}

export async function startSlackApp(): Promise<void> {
  if (!app) {
    app = await initSlackApp();
  }

  if (app) {
    await app.start();
    logger.info('Slack app started');
  }
}

export async function stopSlackApp(): Promise<void> {
  if (app) {
    await app.stop();
    logger.info('Slack app stopped');
  }
}

// Function for callback system to send intermediate messages
export async function sendSlackUpdate(
  sessionId: string,
  message: string,
  type: 'progress' | 'warning' | 'success' | 'error' = 'progress'
): Promise<boolean> {
  const context = activeContexts.get(sessionId);
  if (!context || !app) return false;

  try {
    const formatted = formatIntermediateUpdate(message, type);
    await app.client.chat.postMessage({
      channel: context.channelId,
      text: formatted.text,
      blocks: formatted.blocks as never[],
      thread_ts: context.threadTs,
    });
    return true;
  } catch (error) {
    logger.error({ error, sessionId }, 'Failed to send Slack update');
    return false;
  }
}

export { app };
