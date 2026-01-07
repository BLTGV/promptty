import { loadEnv, resetEnvCache } from './config/env.js';
import { loadConfig, resetConfigCache } from './config/loader.js';
import { getDb, closeDb } from './db/sqlite.js';
import { cleanupExpiredSessions } from './db/sessions.js';
import { startSlackApp, stopSlackApp } from './platforms/slack/adapter.js';
import { startTeamsServer, stopTeamsServer } from './platforms/teams/adapter.js';
import { startCallbackServer, stopCallbackServer } from './callbacks/server.js';
import { logger } from './utils/logger.js';

const SESSION_CLEANUP_INTERVAL = 60000; // 1 minute

let cleanupTimer: NodeJS.Timeout | null = null;
let isRunning = false;

export interface ServerOptions {
  envFile?: string;
  configPath?: string;
  dataDir?: string;
  callbackPort?: number;
  logLevel?: string;
  instanceName?: string;
}

/**
 * Start the Promptty server with the given options
 */
export async function startServer(options: ServerOptions = {}): Promise<void> {
  if (isRunning) {
    throw new Error('Server is already running');
  }

  // Reset caches to ensure fresh config
  resetEnvCache();
  resetConfigCache();

  // Load environment from specified .env file
  if (options.envFile) {
    loadEnv(options.envFile);
  }

  // Apply CLI overrides to process.env before loading
  if (options.configPath) {
    process.env.CONFIG_PATH = options.configPath;
  }
  if (options.dataDir) {
    process.env.DATA_DIR = options.dataDir;
  }
  if (options.callbackPort) {
    process.env.CALLBACK_PORT = String(options.callbackPort);
  }
  if (options.logLevel) {
    process.env.LOG_LEVEL = options.logLevel;
  }
  if (options.instanceName) {
    process.env.PROMPTTY_INSTANCE = options.instanceName;
  }

  // Now load the environment with all overrides applied
  const env = loadEnv();

  logger.info(
    {
      dataDir: env.DATA_DIR,
      logLevel: env.LOG_LEVEL,
      instance: options.instanceName || 'default',
    },
    'Starting Promptty'
  );

  // Load configuration
  try {
    const config = loadConfig();
    logger.info(
      {
        slackConfigured: !!(config.slack?.botToken || env.SLACK_BOT_TOKEN),
        teamsConfigured: !!(config.teams?.appId || env.TEAMS_APP_ID),
        channelCount: Object.keys(config.channels).length,
      },
      'Configuration loaded'
    );
  } catch (error) {
    logger.fatal({ error }, 'Failed to load configuration');
    throw error;
  }

  // Initialize database
  try {
    getDb();
    logger.info('Database initialized');
  } catch (error) {
    logger.fatal({ error }, 'Failed to initialize database');
    throw error;
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

  isRunning = true;
  logger.info('Promptty started successfully');
}

/**
 * Stop the Promptty server gracefully
 */
export async function stopServer(): Promise<void> {
  if (!isRunning) {
    return;
  }

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

  isRunning = false;
  logger.info('Promptty shutdown complete');
}

/**
 * Setup graceful shutdown handlers
 */
export function setupShutdownHandlers(): void {
  const shutdown = async () => {
    await stopServer();
    process.exit(0);
  };

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
}
