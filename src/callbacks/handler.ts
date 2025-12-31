import { sendUpdate, type UpdateType } from '../platforms/router.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('callback-handler');

export interface CallbackRequest {
  sessionId: string;
  message: string;
  type?: UpdateType;
  metadata?: Record<string, unknown>;
}

export async function handleCallback(request: CallbackRequest): Promise<boolean> {
  logger.debug({
    sessionId: request.sessionId,
    type: request.type,
    messagePreview: request.message.substring(0, 50),
  }, 'Processing callback request');

  try {
    const success = await sendUpdate(
      request.sessionId,
      request.message,
      request.type ?? 'progress'
    );

    if (!success) {
      logger.warn({ sessionId: request.sessionId }, 'Failed to deliver callback - session may be inactive');
    }

    return success;
  } catch (error) {
    logger.error({ error, sessionId: request.sessionId }, 'Error processing callback');
    return false;
  }
}

// Convenience functions for typed callbacks
export async function sendProgress(sessionId: string, message: string): Promise<boolean> {
  return handleCallback({ sessionId, message, type: 'progress' });
}

export async function sendWarning(sessionId: string, message: string): Promise<boolean> {
  return handleCallback({ sessionId, message, type: 'warning' });
}

export async function sendSuccess(sessionId: string, message: string): Promise<boolean> {
  return handleCallback({ sessionId, message, type: 'success' });
}

export async function sendError(sessionId: string, message: string): Promise<boolean> {
  return handleCallback({ sessionId, message, type: 'error' });
}
