import { env } from './config/env.js';
import { loadConfig } from './config/loader.js';
import { getDb, closeDb } from './db/sqlite.js';
import { cleanupExpiredSessions } from './db/sessions.js';
import { startSlackApp, stopSlackApp } from './platforms/slack/adapter.js';
import { startTeamsServer, stopTeamsServer } from './platforms/teams/adapter.js';
import { startCallbackServer, stopCallbackServer } from './callbacks/server.js';
import { logger } from './utils/logger.js';

const SESSION_CLEANUP_INTERVAL = 60000; // 1 minute

let cleanupTimer: NodeJS.Timeout | null = null;

async function main(): Promise<void> {
  logger.info({ dataDir: env.DATA_DIR, logLevel: env.LOG_LEVEL }, 'Starting Promptty');

  // Load configuration
  try {
    const config = loadConfig();
    logger.info({
      slackConfigured: !!(config.slack?.botToken || env.SLACK_BOT_TOKEN),
      teamsConfigured: !!(config.teams?.appId || env.TEAMS_APP_ID),
      channelCount: Object.keys(config.channels).length,
    }, 'Configuration loaded');
  } catch (error) {
    logger.fatal({ error }, 'Failed to load configuration');
    process.exit(1);
  }

  // Initialize database
  try {
    getDb();
    logger.info('Database initialized');
  } catch (error) {
    logger.fatal({ error }, 'Failed to initialize database');
    process.exit(1);
  }

  // Start session cleanup timer
  cleanupTimer = setInterval(() => {
    try {
      cleanupExpiredSessions();
    } catch (error) {
      logger.error({ error }, 'Error during session cleanup');
    }
  }, SESSION_CLEANUP_INTERVAL);

  // Start callback server for MCP/hook callbacks
  try {
    startCallbackServer();
  } catch (error) {
    logger.error({ error }, 'Failed to start callback server');
  }

  // Start Slack adapter
  try {
    await startSlackApp();
  } catch (error) {
    logger.error({ error }, 'Failed to start Slack adapter');
  }

  // Start Teams adapter
  try {
    await startTeamsServer();
  } catch (error) {
    logger.error({ error }, 'Failed to start Teams adapter');
  }

  logger.info('Promptty started successfully');
}

async function shutdown(): Promise<void> {
  logger.info('Shutting down Promptty...');

  // Clear cleanup timer
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }

  // Stop adapters
  try {
    await stopSlackApp();
  } catch (error) {
    logger.error({ error }, 'Error stopping Slack adapter');
  }

  try {
    await stopTeamsServer();
  } catch (error) {
    logger.error({ error }, 'Error stopping Teams adapter');
  }

  // Stop callback server
  try {
    stopCallbackServer();
  } catch (error) {
    logger.error({ error }, 'Error stopping callback server');
  }

  // Close database
  try {
    closeDb();
  } catch (error) {
    logger.error({ error }, 'Error closing database');
  }

  logger.info('Promptty shutdown complete');
  process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception');
  shutdown();
});
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection');
  shutdown();
});

// Start the application
main().catch((error) => {
  logger.fatal({ error }, 'Failed to start Promptty');
  process.exit(1);
});
