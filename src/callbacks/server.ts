import { sendUpdate, type UpdateType } from '../platforms/router.js';
import { createChildLogger } from '../utils/logger.js';
import { env } from '../config/env.js';

const logger = createChildLogger('callbacks');

let server: ReturnType<typeof Bun.serve> | null = null;

export interface CallbackPayload {
  session_id: string;
  message: string;
  type?: UpdateType;
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

      // Callback endpoint
      if (url.pathname === '/callback' && req.method === 'POST') {
        try {
          const payload: CallbackPayload = await req.json();

          if (!payload.session_id || !payload.message) {
            return Response.json({ error: 'Missing session_id or message' }, { status: 400 });
          }

          logger.debug({
            sessionId: payload.session_id,
            type: payload.type,
            messageLength: payload.message.length,
          }, 'Received callback');

          const success = await sendUpdate(
            payload.session_id,
            payload.message,
            payload.type ?? 'progress'
          );

          if (success) {
            return Response.json({ success: true });
          } else {
            return Response.json({ error: 'Session not found or inactive' }, { status: 404 });
          }
        } catch (error) {
          logger.error({ error }, 'Error handling callback');
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
