import { App, LogLevel } from '@slack/bolt';
import { env } from '../../config/env.js';
import { loadConfig, getChannelConfig } from '../../config/loader.js';
import { shouldRespondToMessage, type MessageFilterContext } from '../../config/types.js';
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

  // Handle direct messages and channel messages (but not @mentions, those go to app_mention)
  app.message(async ({ message, client, say, context: slackContext }) => {
    // Only handle user messages (not bot messages)
    if (message.subtype || !('text' in message) || !message.text) {
      return;
    }

    // Skip messages that @mention the bot - those are handled by app_mention event
    const botUserId = slackContext.botUserId;
    if (botUserId && message.text.includes(`<@${botUserId}>`)) {
      return;
    }

    const channelId = message.channel;
    const threadTs = ('thread_ts' in message ? message.thread_ts : message.ts) ?? message.ts;
    const workspaceId = (await client.auth.test()).team_id ?? 'unknown';
    const userId = message.user ?? 'unknown';
    const text = message.text;

    // Determine if this is a DM (channel starts with D) or thread
    const isDM = channelId.startsWith('D');
    const isThread = 'thread_ts' in message && message.thread_ts !== undefined;

    logger.debug({ channelId, threadTs, userId, isDM, isThread }, 'Received Slack message');

    // Get channel configuration
    let channelConfig = getChannelConfig({
      platform: 'slack',
      workspaceId,
      channelId,
    });

    if (!channelConfig) {
      // For DMs, check if defaults allow DMs
      if (isDM) {
        const config = loadConfig();
        const defaultFilter = config.defaults?.responseFilter;
        const allowDMs = defaultFilter?.allowDMs ?? true; // Default to true for backward compat

        if (!allowDMs) {
          logger.debug({ channelId }, 'DMs disabled in defaults, ignoring');
          return;
        }

        // Use defaults for DM if available
        if (config.defaults?.workingDirectory) {
          channelConfig = {
            workingDirectory: config.defaults.workingDirectory,
            command: config.defaults.command ?? 'claude',
            sessionTTL: config.defaults.sessionTTL ?? 14400000,
            systemPrompt: config.defaults.systemPrompt,
            allowedTools: config.defaults.allowedTools,
            skipPermissions: config.defaults.skipPermissions,
            responseFilter: config.defaults.responseFilter,
          };
          logger.debug({ channelId }, 'Using defaults for DM');
        } else {
          logger.debug({ channelId }, 'No defaults configured for DMs, ignoring');
          return;
        }
      } else {
        logger.debug({ channelId, workspaceId }, 'No configuration for this channel, ignoring');
        return;
      }
    }

    // Apply response filter
    const filterContext: MessageFilterContext = {
      text,
      isMention: false, // Not a mention - those go to app_mention
      isDM,
      isThread,
      botUserId,
    };

    if (!shouldRespondToMessage(channelConfig.responseFilter, filterContext)) {
      logger.debug({ channelId, filterMode: channelConfig.responseFilter?.mode }, 'Message filtered out');
      return;
    }

    logger.info({ channelId, threadTs, userId, textLength: text.length }, 'Processing Slack message');

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
    const isThread = event.thread_ts !== undefined;

    logger.debug({ channelId: event.channel, isThread }, 'Received app mention');

    const channelConfig = getChannelConfig({
      platform: 'slack',
      workspaceId,
      channelId: event.channel,
    });

    if (!channelConfig) {
      logger.debug({ channelId: event.channel, workspaceId }, 'No configuration for this channel');
      return;
    }

    // Apply response filter - mentions are always treated as mentions
    const filterContext: MessageFilterContext = {
      text,
      isMention: true,
      isDM: false, // Mentions in DMs would go to the message handler
      isThread,
    };

    if (!shouldRespondToMessage(channelConfig.responseFilter, filterContext)) {
      logger.debug({ channelId: event.channel, filterMode: channelConfig.responseFilter?.mode }, 'Mention filtered out');
      return;
    }

    logger.info({ channelId: event.channel, textLength: text.length }, 'Processing app mention');

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

// Cross-channel messaging - send to any Slack channel
export interface ChannelTarget {
  platform: 'slack' | 'teams';
  channelId: string;
  workspaceId?: string;
  message: string;
  threadTs?: string;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  threadTs?: string;
  error?: string;
}

export async function sendSlackToChannel(target: ChannelTarget): Promise<SendMessageResult> {
  if (!app) {
    return { success: false, error: 'Slack app not initialized' };
  }

  try {
    const formatted = formatIntermediateUpdate(target.message, 'progress');
    const result = await app.client.chat.postMessage({
      channel: target.channelId,
      text: formatted.text,
      blocks: formatted.blocks as never[],
      thread_ts: target.threadTs,
    });

    return {
      success: true,
      messageId: result.ts,
      threadTs: target.threadTs ?? result.ts,
    };
  } catch (error) {
    logger.error({ error, channelId: target.channelId }, 'Failed to send cross-channel Slack message');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get list of Slack channels the bot has access to
export interface ChannelInfo {
  platform: 'slack' | 'teams';
  channelId: string;
  name?: string;
  workspaceId?: string;
  configured: boolean;
}

export async function getSlackChannels(): Promise<ChannelInfo[]> {
  if (!app) {
    return [];
  }

  try {
    const result = await app.client.conversations.list({
      types: 'public_channel,private_channel,im',
      exclude_archived: true,
      limit: 100,
    });

    const authTest = await app.client.auth.test();
    const workspaceId = authTest.team_id ?? 'unknown';

    return (result.channels ?? []).map(ch => ({
      platform: 'slack' as const,
      channelId: ch.id ?? '',
      name: ch.name ?? ch.id,
      workspaceId,
      configured: false,  // Will be updated by router
    }));
  } catch (error) {
    logger.debug({ error }, 'Could not list Slack channels');
    return [];
  }
}

export { app };
