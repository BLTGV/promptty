import { readFileSync, existsSync } from 'fs';
import { configSchema, type Config, type ChannelConfig, makeChannelKey, type ChannelKey } from './types.js';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let cachedConfig: Config | null = null;

export function loadConfig(configPath: string = env.CONFIG_PATH): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (!existsSync(configPath)) {
    logger.warn({ configPath }, 'Config file not found, using defaults');
    cachedConfig = {
      channels: {},
      defaults: {
        command: 'claude',
        sessionTTL: 14400000,
      },
    };
    return cachedConfig;
  }

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const result = configSchema.safeParse(parsed);

    if (!result.success) {
      logger.error({ errors: result.error.format() }, 'Config validation failed');
      throw new Error('Invalid configuration file');
    }

    cachedConfig = result.data;
    logger.info({ channelCount: Object.keys(cachedConfig.channels).length }, 'Config loaded');
    return cachedConfig;
  } catch (error) {
    logger.error({ error, configPath }, 'Failed to load config');
    throw error;
  }
}

export function getChannelConfig(key: ChannelKey): ChannelConfig | null {
  const config = loadConfig();
  const channelKey = makeChannelKey(key);

  const channelConfig = config.channels[channelKey];
  if (channelConfig) {
    return {
      ...config.defaults,
      ...channelConfig,
    };
  }

  // Return defaults if available
  if (config.defaults?.workingDirectory) {
    return {
      workingDirectory: config.defaults.workingDirectory,
      command: config.defaults.command ?? 'claude',
      sessionTTL: config.defaults.sessionTTL ?? 14400000,
      systemPrompt: config.defaults.systemPrompt,
      allowedTools: config.defaults.allowedTools,
    };
  }

  return null;
}

export function reloadConfig(): void {
  cachedConfig = null;
  loadConfig();
}
