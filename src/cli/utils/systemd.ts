import { homedir } from 'os';
import { join, dirname } from 'path';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { execSync, spawnSync } from 'child_process';
import { resolveInstance } from './instance.js';

const SYSTEMD_USER_DIR = join(homedir(), '.config', 'systemd', 'user');

/**
 * Get the service name for an instance
 */
export function getServiceName(instance: string): string {
  return `promptty-${instance}.service`;
}

/**
 * Get the full path to the service file
 */
export function getServicePath(instance: string): string {
  return join(SYSTEMD_USER_DIR, getServiceName(instance));
}

/**
 * Find the bun executable path
 */
function getBunPath(): string {
  try {
    return execSync('which bun', { encoding: 'utf-8' }).trim();
  } catch {
    // Fallback to common locations
    const bunHome = join(homedir(), '.bun', 'bin', 'bun');
    if (existsSync(bunHome)) {
      return bunHome;
    }
    return 'bun'; // Hope it's in PATH
  }
}

/**
 * Find the promptty installation directory
 */
function getPrompttyPath(): string {
  // Use __dirname equivalent for ESM
  const currentFile = new URL(import.meta.url).pathname;
  // Navigate up from src/cli/utils/ to project root
  return dirname(dirname(dirname(dirname(currentFile))));
}

/**
 * Generate a systemd service file for an instance
 */
export function generateServiceFile(instance: string): string {
  const paths = resolveInstance(instance);
  const bunPath = getBunPath();
  const prompttyPath = getPrompttyPath();

  return `[Unit]
Description=Promptty - ${instance} instance
Documentation=https://github.com/anthropics/promptty
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${bunPath} run ${join(prompttyPath, 'src', 'cli', 'index.ts')} serve ${instance}
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
WorkingDirectory=${paths.root}
Environment="PATH=${process.env.PATH}"
Environment="HOME=${homedir()}"

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=${paths.root}

[Install]
WantedBy=default.target
`;
}

/**
 * Install the service file for an instance
 */
export function installService(instance: string): void {
  if (!existsSync(SYSTEMD_USER_DIR)) {
    mkdirSync(SYSTEMD_USER_DIR, { recursive: true });
  }

  const content = generateServiceFile(instance);
  const path = getServicePath(instance);

  writeFileSync(path, content, { mode: 0o644 });

  // Reload systemd
  execSync('systemctl --user daemon-reload', { stdio: 'inherit' });
}

/**
 * Uninstall the service file for an instance
 */
export function uninstallService(instance: string): void {
  const path = getServicePath(instance);

  // Stop and disable first if running
  try {
    execSync(`systemctl --user stop ${getServiceName(instance)}`, { stdio: 'pipe' });
  } catch {
    // Ignore if not running
  }
  try {
    execSync(`systemctl --user disable ${getServiceName(instance)}`, { stdio: 'pipe' });
  } catch {
    // Ignore if not enabled
  }

  if (existsSync(path)) {
    unlinkSync(path);
    execSync('systemctl --user daemon-reload', { stdio: 'inherit' });
  }
}

/**
 * Run a systemctl action on the service
 */
export function serviceAction(
  instance: string,
  action: 'start' | 'stop' | 'restart' | 'enable' | 'disable' | 'status'
): { success: boolean; output: string } {
  const serviceName = getServiceName(instance);

  try {
    const result = spawnSync('systemctl', ['--user', action, serviceName], {
      encoding: 'utf-8',
      stdio: action === 'status' ? 'pipe' : 'inherit',
    });

    return {
      success: result.status === 0,
      output: result.stdout || result.stderr || '',
    };
  } catch (error) {
    return {
      success: false,
      output: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get the service status
 */
export function getServiceStatus(instance: string): {
  installed: boolean;
  enabled: boolean;
  running: boolean;
  status: string;
} {
  const serviceName = getServiceName(instance);
  const servicePath = getServicePath(instance);

  const installed = existsSync(servicePath);

  if (!installed) {
    return { installed: false, enabled: false, running: false, status: 'not installed' };
  }

  // Check if enabled
  let enabled = false;
  try {
    const result = spawnSync('systemctl', ['--user', 'is-enabled', serviceName], {
      encoding: 'utf-8',
    });
    enabled = result.stdout?.trim() === 'enabled';
  } catch {
    // Ignore
  }

  // Check if running
  let running = false;
  let status = 'unknown';
  try {
    const result = spawnSync('systemctl', ['--user', 'is-active', serviceName], {
      encoding: 'utf-8',
    });
    status = result.stdout?.trim() || 'unknown';
    running = status === 'active';
  } catch {
    // Ignore
  }

  return { installed, enabled, running, status };
}

/**
 * View service logs
 */
export function viewServiceLogs(instance: string, follow: boolean = false, lines: number = 50): void {
  const serviceName = getServiceName(instance);
  const args = ['--user', '-u', serviceName, '-n', String(lines)];
  if (follow) {
    args.push('-f');
  }

  spawnSync('journalctl', args, { stdio: 'inherit' });
}

/**
 * List all promptty services
 */
export function listServices(): Array<{ instance: string; status: ReturnType<typeof getServiceStatus> }> {
  if (!existsSync(SYSTEMD_USER_DIR)) {
    return [];
  }

  const files = require('fs').readdirSync(SYSTEMD_USER_DIR) as string[];
  const services: Array<{ instance: string; status: ReturnType<typeof getServiceStatus> }> = [];

  for (const file of files) {
    const match = file.match(/^promptty-(.+)\.service$/);
    if (match) {
      const instance = match[1];
      services.push({
        instance,
        status: getServiceStatus(instance),
      });
    }
  }

  return services;
}
