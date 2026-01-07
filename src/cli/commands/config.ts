import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import {
  resolveInstance,
  instanceExists,
  listInstances,
} from '../utils/instance.js';
import { runChannelForm, runCredentialForm } from '../ui/ConfigForm.js';

export const configCommand = new Command('config')
  .description('Manage Promptty configuration');

// config show
configCommand
  .command('show')
  .description('Display configuration for an instance')
  .argument('[instance]', 'Instance name')
  .action((instance?: string) => {
    const paths = getInstancePaths(instance);

    console.log(`Instance: ${instance || 'current directory'}`);
    console.log(`Config: ${paths.config}`);
    console.log('');

    if (existsSync(paths.config)) {
      const config = JSON.parse(readFileSync(paths.config, 'utf-8'));
      console.log('Configuration:');
      console.log(JSON.stringify(config, null, 2));
    } else {
      console.log('No config.json found');
    }

    console.log('');
    console.log('Credentials:');
    if (existsSync(paths.env)) {
      const env = readFileSync(paths.env, 'utf-8');
      // Mask sensitive values
      const masked = env.replace(/^([^#=]+TOKEN|PASSWORD|SECRET)=(.+)$/gm, (_, key, value) => {
        const masked = value.length > 8 ? value.slice(0, 4) + '****' + value.slice(-4) : '****';
        return `${key}=${masked}`;
      });
      console.log(masked);
    } else {
      console.log('No .env file found');
    }
  });

// config edit
configCommand
  .command('edit')
  .description('Open configuration in editor')
  .argument('[instance]', 'Instance name')
  .option('--env', 'Edit .env file instead of config.json')
  .action((instance?: string, options?: { env?: boolean }) => {
    const paths = getInstancePaths(instance);
    const file = options?.env ? paths.env : paths.config;

    if (!existsSync(file)) {
      console.error(`File not found: ${file}`);
      process.exit(1);
    }

    const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
    try {
      execSync(`${editor} "${file}"`, { stdio: 'inherit' });
    } catch {
      console.error(`Failed to open editor: ${editor}`);
      process.exit(1);
    }
  });

// config validate
configCommand
  .command('validate')
  .description('Validate configuration')
  .argument('[instance]', 'Instance name')
  .action((instance?: string) => {
    const paths = getInstancePaths(instance);

    let hasErrors = false;

    // Validate config.json
    if (!existsSync(paths.config)) {
      console.error('Missing config.json');
      hasErrors = true;
    } else {
      try {
        const config = JSON.parse(readFileSync(paths.config, 'utf-8'));
        console.log('config.json: Valid JSON');

        if (!config.channels || typeof config.channels !== 'object') {
          console.warn('Warning: No channels configured');
        } else {
          const channelCount = Object.keys(config.channels).length;
          console.log(`  Channels: ${channelCount}`);
        }
      } catch (error) {
        console.error('config.json: Invalid JSON');
        hasErrors = true;
      }
    }

    // Validate .env
    if (!existsSync(paths.env)) {
      console.warn('Warning: No .env file found');
    } else {
      const env = readFileSync(paths.env, 'utf-8');
      // Check for uncommented, non-empty credentials
      const hasSlack = /^SLACK_BOT_TOKEN=\S+/m.test(env);
      const hasTeams = /^TEAMS_APP_ID=\S+/m.test(env);

      if (!hasSlack && !hasTeams) {
        console.warn('Warning: No platform credentials configured');
      } else {
        if (hasSlack) console.log('.env: Slack credentials present');
        if (hasTeams) console.log('.env: Teams credentials present');
      }
    }

    if (hasErrors) {
      console.log('\nValidation failed');
      process.exit(1);
    } else {
      console.log('\nValidation passed');
    }
  });

// config channel subcommands
const channelCommand = configCommand
  .command('channel')
  .description('Manage channels');

channelCommand
  .command('list')
  .description('List configured channels')
  .argument('[instance]', 'Instance name')
  .action((instance?: string) => {
    const paths = getInstancePaths(instance);

    if (!existsSync(paths.config)) {
      console.log('No channels configured');
      return;
    }

    const config = JSON.parse(readFileSync(paths.config, 'utf-8'));
    const channels = config.channels || {};
    const keys = Object.keys(channels);

    if (keys.length === 0) {
      console.log('No channels configured');
      return;
    }

    console.log('Configured channels:');
    for (const key of keys) {
      const ch = channels[key];
      console.log(`  ${key}`);
      console.log(`    Working Directory: ${ch.workingDirectory}`);
      if (ch.responseFilter?.mode) {
        console.log(`    Response Filter: ${ch.responseFilter.mode}`);
      }
    }
  });

channelCommand
  .command('add')
  .description('Add a new channel')
  .argument('[instance]', 'Instance name')
  .action(async (instance?: string) => {
    const paths = getInstancePaths(instance);

    const data = await runChannelForm();
    if (!data) {
      console.log('Cancelled');
      return;
    }

    // Load existing config
    let config: { channels: Record<string, unknown>; defaults?: unknown } = {
      channels: {},
      defaults: { command: 'claude', sessionTTL: 14400000 },
    };
    if (existsSync(paths.config)) {
      config = JSON.parse(readFileSync(paths.config, 'utf-8'));
    }

    // Add channel
    config.channels[data.key] = {
      workingDirectory: data.workingDirectory,
      responseFilter: data.responseFilterMode ? { mode: data.responseFilterMode } : undefined,
    };

    writeFileSync(paths.config, JSON.stringify(config, null, 2));
    console.log(`Channel added: ${data.key}`);
  });

channelCommand
  .command('remove')
  .description('Remove a channel')
  .argument('<key>', 'Channel key to remove')
  .argument('[instance]', 'Instance name')
  .action((key: string, instance?: string) => {
    const paths = getInstancePaths(instance);

    if (!existsSync(paths.config)) {
      console.error('No configuration found');
      process.exit(1);
    }

    const config = JSON.parse(readFileSync(paths.config, 'utf-8'));
    if (!config.channels || !config.channels[key]) {
      console.error(`Channel not found: ${key}`);
      process.exit(1);
    }

    delete config.channels[key];
    writeFileSync(paths.config, JSON.stringify(config, null, 2));
    console.log(`Channel removed: ${key}`);
  });

// config credential subcommands
const credentialCommand = configCommand
  .command('credential')
  .description('Manage credentials');

credentialCommand
  .command('show')
  .description('Show credential status')
  .argument('[instance]', 'Instance name')
  .action((instance?: string) => {
    const paths = getInstancePaths(instance);

    if (!existsSync(paths.env)) {
      console.log('No credentials configured');
      return;
    }

    const env = readFileSync(paths.env, 'utf-8');

    // Check Slack
    const slackApp = env.match(/SLACK_APP_TOKEN=(\S+)/)?.[1];
    const slackBot = env.match(/SLACK_BOT_TOKEN=(\S+)/)?.[1];

    console.log('Slack:');
    if (slackApp && slackBot) {
      console.log(`  App Token: ${maskToken(slackApp)}`);
      console.log(`  Bot Token: ${maskToken(slackBot)}`);
    } else {
      console.log('  Not configured');
    }

    // Check Teams
    const teamsId = env.match(/TEAMS_APP_ID=(\S+)/)?.[1];
    const teamsPass = env.match(/TEAMS_APP_PASSWORD=(\S+)/)?.[1];

    console.log('Teams:');
    if (teamsId && teamsPass) {
      console.log(`  App ID: ${maskToken(teamsId)}`);
      console.log(`  Password: ${maskToken(teamsPass)}`);
    } else {
      console.log('  Not configured');
    }
  });

credentialCommand
  .command('set')
  .description('Set credentials interactively')
  .argument('<platform>', 'Platform (slack or teams)')
  .argument('[instance]', 'Instance name')
  .action(async (platform: string, instance?: string) => {
    if (platform !== 'slack' && platform !== 'teams') {
      console.error('Platform must be "slack" or "teams"');
      process.exit(1);
    }

    const paths = getInstancePaths(instance);
    const data = await runCredentialForm(platform);

    if (!data) {
      console.log('Cancelled');
      return;
    }

    // Load existing .env or create new
    let envContent = '';
    if (existsSync(paths.env)) {
      envContent = readFileSync(paths.env, 'utf-8');
    }

    // Update credentials
    if (data.slack) {
      envContent = updateEnvValue(envContent, 'SLACK_APP_TOKEN', data.slack.appToken);
      envContent = updateEnvValue(envContent, 'SLACK_BOT_TOKEN', data.slack.botToken);
      if (data.slack.signingSecret) {
        envContent = updateEnvValue(envContent, 'SLACK_SIGNING_SECRET', data.slack.signingSecret);
      }
    }

    if (data.teams) {
      envContent = updateEnvValue(envContent, 'TEAMS_APP_ID', data.teams.appId);
      envContent = updateEnvValue(envContent, 'TEAMS_APP_PASSWORD', data.teams.appPassword);
    }

    writeFileSync(paths.env, envContent);
    console.log(`${platform} credentials saved`);
  });

credentialCommand
  .command('oauth')
  .description('Run OAuth flow for Slack')
  .argument('[instance]', 'Instance name')
  .action(async (instance?: string) => {
    console.log('OAuth flow not yet implemented.');
    console.log('Use "promptty config credential set slack" to enter tokens manually.');
  });

// Helper functions
function getInstancePaths(instance?: string) {
  if (!instance) {
    // Use current directory
    return {
      root: process.cwd(),
      config: './config.json',
      env: './.env',
      data: './data',
      logs: './logs',
    };
  }

  if (!instanceExists(instance)) {
    console.error(`Instance '${instance}' not found.`);
    console.log('Available instances:', listInstances().join(', ') || 'none');
    process.exit(1);
  }

  return resolveInstance(instance);
}

function maskToken(token: string): string {
  if (token.length <= 8) return '****';
  return token.slice(0, 4) + '****' + token.slice(-4);
}

function updateEnvValue(content: string, key: string, value: string): string {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  const newLine = `${key}=${value}`;

  if (regex.test(content)) {
    return content.replace(regex, newLine);
  } else {
    // Add new line, handling trailing newline
    return content.trimEnd() + '\n' + newLine + '\n';
  }
}
