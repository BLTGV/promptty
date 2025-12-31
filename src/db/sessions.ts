import { randomUUID } from 'crypto';
import { getDb } from './sqlite.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('sessions');

export interface Session {
  id: string;
  platform: 'slack' | 'teams';
  workspaceId: string;
  channelId: string;
  threadId: string | null;
  claudeSessionId: string | null;
  lastActivity: number;
  expiresAt: number;
  createdAt: number;
}

export interface SessionKey {
  platform: 'slack' | 'teams';
  workspaceId: string;
  channelId: string;
  threadId?: string;
}

interface SessionRow {
  id: string;
  platform: string;
  workspace_id: string;
  channel_id: string;
  thread_id: string | null;
  claude_session_id: string | null;
  last_activity: number;
  expires_at: number;
  created_at: number;
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    platform: row.platform as 'slack' | 'teams',
    workspaceId: row.workspace_id,
    channelId: row.channel_id,
    threadId: row.thread_id,
    claudeSessionId: row.claude_session_id,
    lastActivity: row.last_activity,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export function findSession(key: SessionKey): Session | null {
  const db = getDb();
  const now = Date.now();

  const row = db.query(`
    SELECT * FROM sessions
    WHERE platform = ?
      AND workspace_id = ?
      AND channel_id = ?
      AND (thread_id = ? OR (thread_id IS NULL AND ? IS NULL))
      AND expires_at > ?
    ORDER BY last_activity DESC
    LIMIT 1
  `).get(
    key.platform,
    key.workspaceId,
    key.channelId,
    key.threadId ?? null,
    key.threadId ?? null,
    now
  ) as SessionRow | null;

  if (!row) return null;

  // Update last activity
  db.run('UPDATE sessions SET last_activity = ? WHERE id = ?', [now, row.id]);

  return rowToSession(row);
}

export function createSession(key: SessionKey, ttl: number): Session {
  const db = getDb();
  const now = Date.now();
  const id = randomUUID();

  db.run(`
    INSERT INTO sessions (id, platform, workspace_id, channel_id, thread_id, last_activity, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [id, key.platform, key.workspaceId, key.channelId, key.threadId ?? null, now, now + ttl, now]
  );

  logger.info({ sessionId: id, ...key }, 'Session created');

  return {
    id,
    platform: key.platform,
    workspaceId: key.workspaceId,
    channelId: key.channelId,
    threadId: key.threadId ?? null,
    claudeSessionId: null,
    lastActivity: now,
    expiresAt: now + ttl,
    createdAt: now,
  };
}

export function getOrCreateSession(key: SessionKey, ttl: number): Session {
  const existing = findSession(key);
  if (existing) return existing;
  return createSession(key, ttl);
}

export function updateClaudeSessionId(sessionId: string, claudeSessionId: string): void {
  const db = getDb();
  db.run('UPDATE sessions SET claude_session_id = ?, last_activity = ? WHERE id = ?',
    [claudeSessionId, Date.now(), sessionId]);

  logger.debug({ sessionId, claudeSessionId }, 'Claude session ID updated');
}

export function extendSession(sessionId: string, ttl: number): void {
  const db = getDb();
  const now = Date.now();
  db.run('UPDATE sessions SET last_activity = ?, expires_at = ? WHERE id = ?',
    [now, now + ttl, sessionId]);
}

export function deleteSession(sessionId: string): void {
  const db = getDb();
  db.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
  logger.info({ sessionId }, 'Session deleted');
}

export function cleanupExpiredSessions(): number {
  const db = getDb();
  const result = db.run('DELETE FROM sessions WHERE expires_at < ?', [Date.now()]);

  if (result.changes > 0) {
    logger.info({ count: result.changes }, 'Expired sessions cleaned up');
  }

  return result.changes;
}

export function logMessage(
  sessionId: string,
  direction: 'in' | 'out',
  content: string,
  metadata?: Record<string, unknown>
): void {
  const db = getDb();
  db.run(`
    INSERT INTO message_log (session_id, direction, content, metadata, created_at)
    VALUES (?, ?, ?, ?, ?)
  `,
    [sessionId, direction, content, metadata ? JSON.stringify(metadata) : null, Date.now()]
  );
}

export function getSessionById(sessionId: string): Session | null {
  const db = getDb();
  const row = db.query('SELECT * FROM sessions WHERE id = ?').get(sessionId) as SessionRow | null;
  return row ? rowToSession(row) : null;
}
