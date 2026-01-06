import { sendSlackUpdate, sendSlackToChannel, getSlackChannels, getActiveContext as getSlackContext } from './slack/adapter.js';
import { sendTeamsUpdate, sendTeamsToChannel, getTeamsChannels, getActiveTeamsContext } from './teams/adapter.js';
import { getSessionById } from '../db/sessions.js';
import { loadConfig } from '../config/loader.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('router');

export type UpdateType = 'progress' | 'warning' | 'success' | 'error';

export interface PlatformContext {
  platform: 'slack' | 'teams';
  sessionId: string;
  channelId: string;
  workspaceId: string;
}

// Target for cross-channel messaging
export interface ChannelTarget {
  platform: 'slack' | 'teams';
  channelId: string;
  workspaceId?: string;
  message: string;
  threadTs?: string;  // For Slack thread replies
}

// Result from sending a message
export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  threadTs?: string;
  error?: string;
}

// Channel info for listing
export interface ChannelInfo {
  platform: 'slack' | 'teams';
  channelId: string;
  name?: string;
  workspaceId?: string;
  configured: boolean;  // Whether this channel has config in promptty
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

// Send message to a specific channel (cross-channel)
export async function sendToChannel(target: ChannelTarget): Promise<SendMessageResult> {
  logger.debug({ platform: target.platform, channelId: target.channelId }, 'Sending cross-channel message');

  try {
    if (target.platform === 'slack') {
      return await sendSlackToChannel(target);
    } else if (target.platform === 'teams') {
      return await sendTeamsToChannel(target);
    }

    return { success: false, error: `Unknown platform: ${target.platform}` };
  } catch (error) {
    logger.error({ error, target }, 'Failed to send cross-channel message');
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Get list of channels available to the session
export async function getAvailableChannels(sessionId: string): Promise<ChannelInfo[]> {
  const session = getSessionById(sessionId);
  if (!session) {
    logger.warn({ sessionId }, 'Session not found for channel listing');
    return [];
  }

  // Get configured channels from config
  const config = loadConfig();
  const channels: ChannelInfo[] = [];

  // Add configured channels
  for (const key of Object.keys(config.channels)) {
    const match = key.match(/^(slack|teams):([^/]+)\/(.+)$/);
    if (match) {
      channels.push({
        platform: match[1] as 'slack' | 'teams',
        workspaceId: match[2],
        channelId: match[3],
        configured: true,
      });
    }
  }

  // Optionally get live channels from Slack/Teams APIs
  // This would require additional scopes and is optional
  try {
    if (session.platform === 'slack') {
      const slackChannels = await getSlackChannels();
      for (const ch of slackChannels) {
        if (!channels.find(c => c.platform === 'slack' && c.channelId === ch.channelId)) {
          channels.push({ ...ch, configured: false });
        } else {
          // Update with name if available
          const existing = channels.find(c => c.platform === 'slack' && c.channelId === ch.channelId);
          if (existing && ch.name) existing.name = ch.name;
        }
      }
    } else if (session.platform === 'teams') {
      const teamsChannels = await getTeamsChannels();
      for (const ch of teamsChannels) {
        if (!channels.find(c => c.platform === 'teams' && c.channelId === ch.channelId)) {
          channels.push({ ...ch, configured: false });
        } else {
          const existing = channels.find(c => c.platform === 'teams' && c.channelId === ch.channelId);
          if (existing && ch.name) existing.name = ch.name;
        }
      }
    }
  } catch (error) {
    logger.debug({ error }, 'Could not fetch live channel list - using config only');
  }

  return channels;
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
