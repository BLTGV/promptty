import { sendUpdate, sendToChannel, getAvailableChannels, type UpdateType } from '../platforms/router.js';
import { createChildLogger } from '../utils/logger.js';
import { env } from '../config/env.js';

const logger = createChildLogger('callbacks');

let server: ReturnType<typeof Bun.serve> | null = null;

export interface CallbackPayload {
  session_id: string;
  message: string;
  type?: UpdateType;
}

// Cross-channel message payload
export interface ChannelMessagePayload {
  session_id: string;  // For auth/context
  platform: 'slack' | 'teams';
  channel_id: string;
  message: string;
  thread_ts?: string;  // For Slack thread replies
  workspace_id?: string;  // For multi-workspace Slack
}

export function startCallbackServer(port: number = env.CALLBACK_PORT): ReturnType<typeof Bun.serve> {
  server = Bun.serve({
    port,
    hostname: '127.0.0.1', // localhost only for security

    async fetch(req) {
      const url = new URL(req.url);

      // Health check
      if (url.pathname === '/health' && req.method === 'GET') {
        return Response.json({ status: 'ok', timestamp: Date.now() });
      }

      // Callback endpoint (sends to current session's thread)
      if (url.pathname === '/callback' && req.method === 'POST') {
        try {
          const payload: CallbackPayload = await req.json();

          if (!payload.session_id || !payload.message) {
            return Response.json({ error: 'Missing session_id or message' }, { status: 400 });
          }

          logger.info({
            sessionId: payload.session_id,
            type: payload.type ?? 'progress',
            message: payload.message.substring(0, 200),
          }, 'MCP callback received');

          const success = await sendUpdate(
            payload.session_id,
            payload.message,
            payload.type ?? 'progress'
          );

          if (success) {
            logger.info({
              sessionId: payload.session_id,
              type: payload.type ?? 'progress',
            }, 'MCP callback delivered');
            return Response.json({ success: true });
          } else {
            logger.warn({ sessionId: payload.session_id }, 'MCP callback failed - session not found');
            return Response.json({ error: 'Session not found or inactive' }, { status: 404 });
          }
        } catch (error) {
          logger.error({ error }, 'Error handling callback');
          return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
      }

      // Send message to any channel (cross-channel messaging)
      if (url.pathname === '/message' && req.method === 'POST') {
        try {
          const payload: ChannelMessagePayload = await req.json();

          if (!payload.session_id || !payload.platform || !payload.channel_id || !payload.message) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
          }

          logger.info({
            sessionId: payload.session_id,
            platform: payload.platform,
            channelId: payload.channel_id,
            message: payload.message.substring(0, 200),
          }, 'Cross-channel message received');

          const result = await sendToChannel({
            platform: payload.platform,
            channelId: payload.channel_id,
            workspaceId: payload.workspace_id,
            message: payload.message,
            threadTs: payload.thread_ts,
          });

          if (result.success) {
            logger.info({
              platform: payload.platform,
              channelId: payload.channel_id,
              messageId: result.messageId,
            }, 'Cross-channel message delivered');
            return Response.json({
              success: true,
              messageId: result.messageId,
              threadTs: result.threadTs,
            });
          } else {
            logger.warn({
              platform: payload.platform,
              channelId: payload.channel_id,
              error: result.error,
            }, 'Cross-channel message failed');
            return Response.json({ error: result.error ?? 'Failed to send message' }, { status: 400 });
          }
        } catch (error) {
          logger.error({ error }, 'Error handling cross-channel message');
          return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
      }

      // List available channels
      if (url.pathname === '/channels' && req.method === 'GET') {
        try {
          const sessionId = url.searchParams.get('session_id');
          if (!sessionId) {
            return Response.json({ error: 'Missing session_id parameter' }, { status: 400 });
          }

          const channels = await getAvailableChannels(sessionId);
          return Response.json({ channels });
        } catch (error) {
          logger.error({ error }, 'Error listing channels');
          return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
      }

      return Response.json({ error: 'Not found' }, { status: 404 });
    },
  });

  logger.info({ port }, 'Callback server started (localhost only)');
  return server;
}

export function stopCallbackServer(): void {
  if (server) {
    server.stop();
    logger.info('Callback server stopped');
    server = null;
  }
}

export { server };
