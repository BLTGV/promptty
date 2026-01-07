import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readdirSync, mkdirSync } from 'fs';

export const PROMPTTY_HOME = join(homedir(), '.promptty');
export const INSTANCES_DIR = join(PROMPTTY_HOME, 'instances');

export interface InstancePaths {
  root: string;
  config: string;
  env: string;
  data: string;
  logs: string;
}

/**
 * Resolve the paths for an instance by name
 */
export function resolveInstance(name: string): InstancePaths {
  const root = join(INSTANCES_DIR, name);
  return {
    root,
    config: join(root, 'config.json'),
    env: join(root, '.env'),
    data: join(root, 'data'),
    logs: join(root, 'logs'),
  };
}

/**
 * Check if an instance exists and has valid configuration
 */
export function instanceExists(name: string): boolean {
  const paths = resolveInstance(name);
  return existsSync(paths.root) && existsSync(paths.config);
}

/**
 * List all configured instances
 */
export function listInstances(): string[] {
  if (!existsSync(INSTANCES_DIR)) {
    return [];
  }
  return readdirSync(INSTANCES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => instanceExists(name));
}

/**
 * Validate instance name as a valid slug
 * Rules: lowercase, alphanumeric, hyphens allowed (not at start/end for multi-char)
 */
export function validateInstanceName(name: string): { valid: boolean; error?: string } {
  if (!name || name.length === 0) {
    return { valid: false, error: 'Instance name cannot be empty' };
  }
  if (name.length > 64) {
    return { valid: false, error: 'Instance name cannot exceed 64 characters' };
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name)) {
    return {
      valid: false,
      error: 'Instance name must be lowercase alphanumeric with optional hyphens (not at start/end)',
    };
  }
  if (name.includes('--')) {
    return { valid: false, error: 'Instance name cannot contain consecutive hyphens' };
  }
  return { valid: true };
}

/**
 * Create the directory structure for a new instance
 */
export function createInstanceDirs(name: string): InstancePaths {
  const paths = resolveInstance(name);

  mkdirSync(paths.root, { recursive: true });
  mkdirSync(paths.data, { recursive: true });
  mkdirSync(paths.logs, { recursive: true });

  return paths;
}

/**
 * Resolve server paths based on instance name, directory path, or current directory
 */
export function resolveServerPaths(instanceOrPath?: string): {
  configPath: string;
  dataDir: string;
  envFile?: string;
  instanceName?: string;
} {
  // No argument: use current directory (legacy mode)
  if (!instanceOrPath) {
    return {
      configPath: process.env.CONFIG_PATH || './config.json',
      dataDir: process.env.DATA_DIR || './data',
    };
  }

  // Path provided directly (starts with / or ./)
  if (instanceOrPath.startsWith('/') || instanceOrPath.startsWith('./')) {
    const envPath = join(instanceOrPath, '.env');
    return {
      configPath: join(instanceOrPath, 'config.json'),
      dataDir: join(instanceOrPath, 'data'),
      envFile: existsSync(envPath) ? envPath : undefined,
    };
  }

  // Instance name
  const paths = resolveInstance(instanceOrPath);
  if (!instanceExists(instanceOrPath)) {
    throw new Error(`Instance '${instanceOrPath}' does not exist. Run 'promptty init ${instanceOrPath}' to create it.`);
  }

  return {
    configPath: paths.config,
    dataDir: paths.data,
    envFile: existsSync(paths.env) ? paths.env : undefined,
    instanceName: instanceOrPath,
  };
}
