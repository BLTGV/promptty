import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  TurnContext,
  ActivityTypes,
  ConversationReference,
  CardFactory,
} from 'botbuilder';
import { env } from '../../config/env.js';
import { loadConfig, getChannelConfig } from '../../config/loader.js';
import { shouldRespondToMessage, type MessageFilterContext } from '../../config/types.js';
import { getOrCreateSession, updateClaudeSessionId, logMessage } from '../../db/sessions.js';
import { executor } from '../../llm/executor.js';
import { formatAcknowledgement, formatResponse, formatError, formatProgress, type AdaptiveCard } from '../../formatters/teams.js';
import { createChildLogger } from '../../utils/logger.js';

const logger = createChildLogger('teams');

let adapter: CloudAdapter | null = null;
let server: ReturnType<typeof Bun.serve> | null = null;

export interface TeamsMessageContext {
  conversationReference: Partial<ConversationReference>;
  tenantId: string;
  channelId: string;
  activityId?: string;
}

// Store active message contexts for callbacks
const activeContexts = new Map<string, TeamsMessageContext>();

export function getActiveTeamsContext(sessionId: string): TeamsMessageContext | undefined {
  return activeContexts.get(sessionId);
}

export async function initTeamsAdapter(): Promise<CloudAdapter | null> {
  const config = loadConfig();

  const appId = config.teams?.appId ?? env.TEAMS_APP_ID;
  const appPassword = config.teams?.appPassword ?? env.TEAMS_APP_PASSWORD;

  if (!appId || !appPassword) {
    logger.info('Teams credentials not configured, skipping Teams adapter');
    return null;
  }

  const botFrameworkAuth = new ConfigurationBotFrameworkAuthentication({
    MicrosoftAppId: appId,
    MicrosoftAppPassword: appPassword,
    MicrosoftAppType: 'MultiTenant',
  });

  adapter = new CloudAdapter(botFrameworkAuth);

  // Error handler
  adapter.onTurnError = async (context, error) => {
    logger.error({ error }, 'Teams adapter error');
    await context.sendActivity('Sorry, an error occurred while processing your request.');
  };

  logger.info('Teams adapter initialized');
  return adapter;
}

async function handleMessage(context: TurnContext): Promise<void> {
  const text = context.activity.text?.trim();

  if (!text) {
    return;
  }

  // Check if bot was mentioned
  const isMention = text.includes('<at>') ||
    (context.activity.entities?.some(e => e.type === 'mention' && e.mentioned?.id === context.activity.recipient.id) ?? false);

  // Remove bot mention if present
  const cleanedText = text.replace(/<at>.*?<\/at>/g, '').trim();

  if (!cleanedText) {
    await context.sendActivity('Hi! Send me a message and I\'ll process it with Claude Code.');
    return;
  }

  const tenantId = context.activity.conversation.tenantId ?? 'unknown';
  const channelId = context.activity.channelId ?? 'unknown';
  const conversationId = context.activity.conversation.id;

  // Determine if this is a DM (personal conversation type)
  const isDM = context.activity.conversation.conversationType === 'personal';
  // Teams threads are indicated by replyToId
  const isThread = context.activity.replyToId !== undefined;

  logger.debug({ tenantId, channelId, isDM, isThread, isMention }, 'Received Teams message');

  // Get channel configuration
  const channelConfig = getChannelConfig({
    platform: 'teams',
    workspaceId: tenantId,
    channelId: conversationId,
  });

  if (!channelConfig) {
    if (!isDM) {
      logger.debug({ tenantId, channelId }, 'No configuration for this channel, ignoring');
    }
    return;
  }

  // Apply response filter
  const filterContext: MessageFilterContext = {
    text: cleanedText,
    isMention,
    isDM,
    isThread,
  };

  if (!shouldRespondToMessage(channelConfig.responseFilter, filterContext)) {
    logger.debug({ channelId, filterMode: channelConfig.responseFilter?.mode }, 'Message filtered out');
    return;
  }

  logger.info({ tenantId, channelId, textLength: cleanedText.length }, 'Processing Teams message');

  // Store conversation reference for potential cross-channel messaging
  const conversationReference = TurnContext.getConversationReference(context.activity);
  storeConversationReference(conversationId, conversationReference);

  // Get or create session
  const session = getOrCreateSession(
    {
      platform: 'teams',
      workspaceId: tenantId,
      channelId: conversationId,
      threadId: context.activity.conversation.id,
    },
    channelConfig.sessionTTL
  );

  // Log incoming message
  logMessage(session.id, 'in', cleanedText);

  // Send acknowledgement
  const ackCard = formatAcknowledgement();
  const ackActivity = await context.sendActivity({
    attachments: [CardFactory.adaptiveCard(ackCard)],
  });

  // Store context for callbacks
  const teamsContext: TeamsMessageContext = {
    conversationReference: TurnContext.getConversationReference(context.activity),
    tenantId,
    channelId: conversationId,
    activityId: ackActivity?.id,
  };
  activeContexts.set(session.id, teamsContext);

  try {
    // Send typing indicator
    await context.sendActivities([{ type: ActivityTypes.Typing }]);

    // Execute Claude Code
    const result = await executor.execute(cleanedText, {
      workingDirectory: channelConfig.workingDirectory,
      sessionId: session.claudeSessionId ?? undefined,
      systemPrompt: channelConfig.systemPrompt,
      allowedTools: channelConfig.allowedTools,
      skipPermissions: channelConfig.skipPermissions,
    });

    // Update Claude session ID if this was a new session
    if (result.claudeSessionId && result.claudeSessionId !== session.claudeSessionId) {
      updateClaudeSessionId(session.id, result.claudeSessionId);
    }

    // Format and send response
    const responseCard = result.success
      ? formatResponse(result.output, result.duration)
      : formatError(result.error ?? result.output);

    // Update the acknowledgement message or send new message
    if (ackActivity?.id) {
      await context.updateActivity({
        id: ackActivity.id,
        type: ActivityTypes.Message,
        attachments: [CardFactory.adaptiveCard(responseCard)],
      });
    } else {
      await context.sendActivity({
        attachments: [CardFactory.adaptiveCard(responseCard)],
      });
    }

    // Log outgoing message
    logMessage(session.id, 'out', result.output, { success: result.success, duration: result.duration });

  } catch (error) {
    logger.error({ error }, 'Error executing Claude Code');

    const errorCard = formatError(error instanceof Error ? error.message : 'Unknown error');
    await context.sendActivity({
      attachments: [CardFactory.adaptiveCard(errorCard)],
    });
  } finally {
    activeContexts.delete(session.id);
  }
}

export async function startTeamsServer(port: number = 3978): Promise<void> {
  if (!adapter) {
    adapter = await initTeamsAdapter();
  }

  if (!adapter) {
    return;
  }

  server = Bun.serve({
    port,

    async fetch(req) {
      const url = new URL(req.url);

      if (req.method === 'POST' && url.pathname === '/api/messages') {
        try {
          const body = await req.json();

          await adapter!.process(
            { body, headers: Object.fromEntries(req.headers) },
            {
              status: (code: number) => ({
                send: (b: unknown) => new Response(typeof b === 'string' ? b : JSON.stringify(b), { status: code }),
              }),
              send: (b: unknown) => new Response(typeof b === 'string' ? b : JSON.stringify(b)),
              end: () => new Response(),
            } as never,
            async (context) => {
              if (context.activity.type === ActivityTypes.Message) {
                await handleMessage(context);
              }
            }
          );

          return new Response('OK');
        } catch (error) {
          logger.error({ error }, 'Error processing Teams message');
          return new Response('Internal Server Error', { status: 500 });
        }
      }

      return new Response('Not Found', { status: 404 });
    },
  });

  logger.info({ port }, 'Teams bot server started');
}

export async function stopTeamsServer(): Promise<void> {
  if (server) {
    server.stop();
    logger.info('Teams bot server stopped');
  }
}

// Function for callback system to send intermediate messages
export async function sendTeamsUpdate(
  sessionId: string,
  message: string,
  type: 'progress' | 'warning' | 'success' | 'error' = 'progress'
): Promise<boolean> {
  const context = activeContexts.get(sessionId);
  if (!context || !adapter) return false;

  try {
    const card = formatProgress(message, type);

    await adapter.continueConversation(
      context.conversationReference,
      async (turnContext) => {
        await turnContext.sendActivity({
          attachments: [CardFactory.adaptiveCard(card)],
        });
      }
    );

    return true;
  } catch (error) {
    logger.error({ error, sessionId }, 'Failed to send Teams update');
    return false;
  }
}

// Cross-channel messaging interfaces
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

// Store conversation references for cross-channel messaging
const conversationReferences = new Map<string, Partial<ConversationReference>>();

export function storeConversationReference(channelId: string, reference: Partial<ConversationReference>): void {
  conversationReferences.set(channelId, reference);
}

// Cross-channel messaging for Teams
export async function sendTeamsToChannel(target: ChannelTarget): Promise<SendMessageResult> {
  if (!adapter) {
    return { success: false, error: 'Teams adapter not initialized' };
  }

  // Get stored conversation reference for this channel
  const reference = conversationReferences.get(target.channelId);
  if (!reference) {
    return { success: false, error: 'No conversation reference for channel - the bot must first receive a message from this channel' };
  }

  try {
    let messageId: string | undefined;
    const card = formatProgress(target.message, 'progress');

    await adapter.continueConversation(
      reference,
      async (turnContext) => {
        const response = await turnContext.sendActivity({
          attachments: [CardFactory.adaptiveCard(card)],
        });
        messageId = response?.id;
      }
    );

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    logger.error({ error, channelId: target.channelId }, 'Failed to send cross-channel Teams message');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get list of Teams channels - Teams API requires specific permissions
export interface ChannelInfo {
  platform: 'slack' | 'teams';
  channelId: string;
  name?: string;
  workspaceId?: string;
  configured: boolean;
}

export async function getTeamsChannels(): Promise<ChannelInfo[]> {
  // Teams doesn't have a simple channel listing API like Slack
  // Return channels from stored conversation references
  const channels: ChannelInfo[] = [];

  for (const [channelId, ref] of conversationReferences.entries()) {
    channels.push({
      platform: 'teams',
      channelId,
      name: (ref.conversation as { name?: string })?.name ?? channelId,
      workspaceId: ref.conversation?.tenantId,
      configured: false,
    });
  }

  return channels;
}

export { adapter };
