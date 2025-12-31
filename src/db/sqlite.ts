import { Database } from 'bun:sqlite';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { env } from '../config/env.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('db');

let db: Database | null = null;

const MIGRATIONS = [
  // Migration 1: Initial schema
  `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    thread_id TEXT,
    claude_session_id TEXT,
    last_activity INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_lookup
    ON sessions(platform, workspace_id, channel_id, thread_id);

  CREATE INDEX IF NOT EXISTS idx_sessions_expires
    ON sessions(expires_at);

  CREATE TABLE IF NOT EXISTS message_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK(direction IN ('in', 'out')),
    content TEXT,
    metadata TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
  );

  CREATE INDEX IF NOT EXISTS idx_message_log_session
    ON message_log(session_id);

  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
  );

  INSERT OR IGNORE INTO schema_version (version) VALUES (1);
  `,
];

export function getDb(): Database {
  if (db) return db;

  const dbPath = `${env.DATA_DIR}/promptty.db`;

  // Ensure data directory exists
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    logger.info({ dir }, 'Created data directory');
  }

  db = new Database(dbPath, { create: true });
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  runMigrations(db);

  logger.info({ dbPath }, 'Database initialized');
  return db;
}

function runMigrations(database: Database): void {
  const currentVersion = getCurrentVersion(database);

  for (let i = currentVersion; i < MIGRATIONS.length; i++) {
    logger.info({ version: i + 1 }, 'Running migration');
    database.exec(MIGRATIONS[i]);
    database.run('UPDATE schema_version SET version = ?', [i + 1]);
  }
}

function getCurrentVersion(database: Database): number {
  try {
    const row = database.query('SELECT version FROM schema_version').get() as { version: number } | null;
    return row?.version ?? 0;
  } catch {
    return 0;
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('Database closed');
  }
}
