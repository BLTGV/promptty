import { sendSlackUpdate, getActiveContext as getSlackContext } from './slack/adapter.js';
import { sendTeamsUpdate, getActiveTeamsContext } from './teams/adapter.js';
import { getSessionById } from '../db/sessions.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('router');

export type UpdateType = 'progress' | 'warning' | 'success' | 'error';

export interface PlatformContext {
  platform: 'slack' | 'teams';
  sessionId: string;
  channelId: string;
  workspaceId: string;
}

export async function sendUpdate(
  sessionId: string,
  message: string,
  type: UpdateType = 'progress'
): Promise<boolean> {
  const session = getSessionById(sessionId);

  if (!session) {
    logger.warn({ sessionId }, 'Session not found for update');
    return false;
  }

  logger.debug({ sessionId, platform: session.platform, type }, 'Sending platform update');

  if (session.platform === 'slack') {
    return sendSlackUpdate(sessionId, message, type);
  } else if (session.platform === 'teams') {
    return sendTeamsUpdate(sessionId, message, type);
  }

  return false;
}

export function hasActiveContext(sessionId: string): boolean {
  const slackContext = getSlackContext(sessionId);
  const teamsContext = getActiveTeamsContext(sessionId);
  return !!(slackContext || teamsContext);
}

export function getPlatformContext(sessionId: string): PlatformContext | null {
  const session = getSessionById(sessionId);
  if (!session) return null;

  return {
    platform: session.platform,
    sessionId: session.id,
    channelId: session.channelId,
    workspaceId: session.workspaceId,
  };
}
