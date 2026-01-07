import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';

const envSchema = z.object({
  // Slack
  SLACK_APP_TOKEN: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),

  // Teams
  TEAMS_APP_ID: z.string().optional(),
  TEAMS_APP_PASSWORD: z.string().optional(),

  // General
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  DATA_DIR: z.string().default('./data'),
  CONFIG_PATH: z.string().default('./config.json'),
  CALLBACK_PORT: z.coerce.number().default(3001),

  // Instance identifier (set by CLI)
  PROMPTTY_INSTANCE: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/**
 * Parse a .env file and load values into process.env
 */
function parseEnvFile(envFile: string): void {
  if (!existsSync(envFile)) {
    return;
  }

  const content = readFileSync(envFile, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      // Remove surrounding quotes if present
      const cleanValue = value.trim().replace(/^["']|["']$/g, '');
      process.env[key.trim()] = cleanValue;
    }
  }
}

/**
 * Load environment variables, optionally from a specific .env file
 */
export function loadEnv(envFile?: string): Env {
  if (cachedEnv && !envFile) {
    return cachedEnv;
  }

  // Load from specified .env file if provided
  if (envFile) {
    parseEnvFile(envFile);
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Environment validation failed:');
    console.error(result.error.format());
    process.exit(1);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

/**
 * Reset the environment cache (useful for reloading with different instance)
 */
export function resetEnvCache(): void {
  cachedEnv = null;
}

/**
 * Lazy-loaded environment proxy for backward compatibility
 * Values are loaded on first access
 */
export const env: Env = new Proxy({} as Env, {
  get(_, prop: string) {
    const loaded = loadEnv();
    return loaded[prop as keyof Env];
  },
});
