import { Command } from 'commander';
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { resolveInstance, instanceExists } from '../utils/instance.js';
import { loadConfig, resetConfigCache } from '../../config/loader.js';
import { loadEnv, resetEnvCache } from '../../config/env.js';

export const mcpCommand = new Command('mcp')
  .description('Manage MCP server for Promptty instances');

// Get the promptty installation directory
function getPrompttyPath(): string {
  const currentFile = new URL(import.meta.url).pathname;
  return dirname(dirname(dirname(dirname(currentFile))));
}

interface McpConfig {
  mcpServers: {
    [key: string]: {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    };
  };
}

mcpCommand
  .command('install')
  .description('Install MCP server to instance working directories')
  .argument('<instance>', 'Instance name')
  .option('--callback-port <port>', 'Callback server port', '3001')
  .action(async (instance: string, options: { callbackPort: string }) => {
    if (!instanceExists(instance)) {
      console.error(`Instance '${instance}' does not exist.`);
      process.exit(1);
    }

    const paths = resolveInstance(instance);

    // Reset caches and load instance config
    resetEnvCache();
    resetConfigCache();

    if (existsSync(paths.env)) {
      loadEnv(paths.env);
    }

    const config = loadConfig(paths.config);

    // Collect all working directories
    const workingDirs = new Set<string>();

    if (config.defaults?.workingDirectory) {
      workingDirs.add(config.defaults.workingDirectory);
    }

    for (const channelConfig of Object.values(config.channels)) {
      if (channelConfig.workingDirectory) {
        workingDirs.add(channelConfig.workingDirectory);
      }
    }

    if (workingDirs.size === 0) {
      console.log('No working directories configured for this instance.');
      console.log('Add workingDirectory to your config.json first.');
      return;
    }

    const prompttyPath = getPrompttyPath();
    const mcpServerPath = join(prompttyPath, 'mcp-server', 'index.ts');

    // Check if MCP server exists
    if (!existsSync(mcpServerPath)) {
      console.error(`MCP server not found at: ${mcpServerPath}`);
      process.exit(1);
    }

    // Install dependencies if needed
    const mcpPackageJson = join(prompttyPath, 'mcp-server', 'package.json');
    const mcpNodeModules = join(prompttyPath, 'mcp-server', 'node_modules');
    if (existsSync(mcpPackageJson) && !existsSync(mcpNodeModules)) {
      console.log('Installing MCP server dependencies...');
      execSync('bun install', { cwd: join(prompttyPath, 'mcp-server'), stdio: 'inherit' });
    }

    // Find bun path
    let bunPath: string;
    try {
      bunPath = execSync('which bun', { encoding: 'utf-8' }).trim();
    } catch {
      bunPath = join(process.env.HOME ?? '', '.bun', 'bin', 'bun');
    }

    console.log(`\nInstalling MCP server to ${workingDirs.size} working director${workingDirs.size === 1 ? 'y' : 'ies'}:\n`);

    for (const dir of workingDirs) {
      if (!existsSync(dir)) {
        console.log(`  ⚠ Skipping (not found): ${dir}`);
        continue;
      }

      const mcpJsonPath = join(dir, '.mcp.json');

      // Read existing .mcp.json if present
      let existingConfig: McpConfig = { mcpServers: {} };
      if (existsSync(mcpJsonPath)) {
        try {
          existingConfig = JSON.parse(readFileSync(mcpJsonPath, 'utf-8'));
        } catch {
          // Invalid JSON, start fresh
        }
      }

      // Add/update promptty server
      existingConfig.mcpServers = existingConfig.mcpServers || {};
      existingConfig.mcpServers['promptty'] = {
        command: bunPath,
        args: ['run', mcpServerPath],
        env: {
          PROMPTTY_CALLBACK_URL: `http://127.0.0.1:${options.callbackPort}`,
        },
      };

      writeFileSync(mcpJsonPath, JSON.stringify(existingConfig, null, 2) + '\n');
      console.log(`  ✓ ${dir}`);
    }

    console.log('\nMCP server installed. Claude Code can now use:');
    console.log('  - post_update: Send progress messages to chat');
    console.log('  - send_to_channel: Send messages to other channels');
    console.log('  - list_channels: List available channels');
  });

mcpCommand
  .command('status')
  .description('Check MCP server installation status')
  .argument('<instance>', 'Instance name')
  .action(async (instance: string) => {
    if (!instanceExists(instance)) {
      console.error(`Instance '${instance}' does not exist.`);
      process.exit(1);
    }

    const paths = resolveInstance(instance);

    resetEnvCache();
    resetConfigCache();

    if (existsSync(paths.env)) {
      loadEnv(paths.env);
    }

    const config = loadConfig(paths.config);

    // Collect all working directories
    const workingDirs = new Set<string>();

    if (config.defaults?.workingDirectory) {
      workingDirs.add(config.defaults.workingDirectory);
    }

    for (const channelConfig of Object.values(config.channels)) {
      if (channelConfig.workingDirectory) {
        workingDirs.add(channelConfig.workingDirectory);
      }
    }

    if (workingDirs.size === 0) {
      console.log('No working directories configured for this instance.');
      return;
    }

    console.log(`MCP server status for ${instance}:\n`);

    for (const dir of workingDirs) {
      const mcpJsonPath = join(dir, '.mcp.json');

      if (!existsSync(dir)) {
        console.log(`  ✗ ${dir} (directory not found)`);
        continue;
      }

      if (!existsSync(mcpJsonPath)) {
        console.log(`  ✗ ${dir} (no .mcp.json)`);
        continue;
      }

      try {
        const mcpConfig: McpConfig = JSON.parse(readFileSync(mcpJsonPath, 'utf-8'));
        if (mcpConfig.mcpServers?.promptty) {
          console.log(`  ✓ ${dir}`);
        } else {
          console.log(`  ○ ${dir} (.mcp.json exists but no promptty server)`);
        }
      } catch {
        console.log(`  ⚠ ${dir} (invalid .mcp.json)`);
      }
    }
  });

mcpCommand
  .command('uninstall')
  .description('Remove MCP server from instance working directories')
  .argument('<instance>', 'Instance name')
  .action(async (instance: string) => {
    if (!instanceExists(instance)) {
      console.error(`Instance '${instance}' does not exist.`);
      process.exit(1);
    }

    const paths = resolveInstance(instance);

    resetEnvCache();
    resetConfigCache();

    if (existsSync(paths.env)) {
      loadEnv(paths.env);
    }

    const config = loadConfig(paths.config);

    // Collect all working directories
    const workingDirs = new Set<string>();

    if (config.defaults?.workingDirectory) {
      workingDirs.add(config.defaults.workingDirectory);
    }

    for (const channelConfig of Object.values(config.channels)) {
      if (channelConfig.workingDirectory) {
        workingDirs.add(channelConfig.workingDirectory);
      }
    }

    console.log(`Removing MCP server from working directories:\n`);

    for (const dir of workingDirs) {
      const mcpJsonPath = join(dir, '.mcp.json');

      if (!existsSync(mcpJsonPath)) {
        console.log(`  - ${dir} (no .mcp.json)`);
        continue;
      }

      try {
        const mcpConfig: McpConfig = JSON.parse(readFileSync(mcpJsonPath, 'utf-8'));

        if (mcpConfig.mcpServers?.promptty) {
          delete mcpConfig.mcpServers.promptty;

          // If no servers left, remove the file
          if (Object.keys(mcpConfig.mcpServers).length === 0) {
            const { unlinkSync } = await import('fs');
            unlinkSync(mcpJsonPath);
            console.log(`  ✓ ${dir} (removed .mcp.json)`);
          } else {
            writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2) + '\n');
            console.log(`  ✓ ${dir} (removed promptty server)`);
          }
        } else {
          console.log(`  - ${dir} (no promptty server configured)`);
        }
      } catch {
        console.log(`  ⚠ ${dir} (invalid .mcp.json, skipping)`);
      }
    }
  });
