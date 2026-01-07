import { Command } from 'commander';
import { writeFileSync } from 'fs';
import {
  validateInstanceName,
  instanceExists,
  createInstanceDirs,
  resolveInstance,
} from '../utils/instance.js';
import { runInitForm, type InitFormData } from '../ui/InitForm.js';

export const initCommand = new Command('init')
  .description('Initialize a new Promptty instance')
  .argument('<name>', 'Instance name (slug, e.g., "acme-corp")')
  .option('-f, --force', 'Overwrite existing instance')
  .option('--no-interactive', 'Skip interactive setup (create empty config)')
  .action(async (name: string, options: { force?: boolean; interactive?: boolean }) => {
    // Validate instance name
    const validation = validateInstanceName(name);
    if (!validation.valid) {
      console.error(`Invalid instance name: ${validation.error}`);
      process.exit(1);
    }

    // Check if already exists
    if (instanceExists(name) && !options.force) {
      console.error(`Instance '${name}' already exists.`);
      console.error('Use --force to overwrite.');
      process.exit(1);
    }

    // Create directory structure
    const paths = createInstanceDirs(name);
    console.log(`Creating instance: ${name}`);
    console.log(`Directory: ${paths.root}`);

    // Non-interactive mode: create empty config
    if (options.interactive === false) {
      createEmptyConfig(paths);
      console.log('\nInstance created with empty configuration.');
      console.log(`Edit ${paths.config} to add channels.`);
      console.log(`Edit ${paths.env} to add credentials.`);
      return;
    }

    // Interactive mode: run TUI form
    try {
      const formData = await runInitForm(name);

      if (!formData) {
        console.log('\nSetup cancelled.');
        return;
      }

      // Handle OAuth flow if selected
      if (formData.setupMethod === 'oauth') {
        console.log('\nOAuth setup selected.');
        console.log('Note: OAuth flow requires additional setup.');
        console.log('Run: promptty config credential oauth ' + name);
        createEmptyConfig(paths);
        return;
      }

      // Write configuration files
      writeConfigFiles(paths, formData);

      console.log('\nInstance created successfully!');
      console.log('\nNext steps:');
      console.log(`  1. Start the server:     promptty serve ${name}`);
      console.log(`  2. Install as service:   promptty service install ${name}`);
      console.log(`  3. Add more channels:    promptty config channel add ${name}`);
    } catch (error) {
      console.error('Error during setup:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

function createEmptyConfig(paths: ReturnType<typeof resolveInstance>): void {
  // Create empty config.json
  const config = {
    defaults: {
      command: 'claude',
      sessionTTL: 14400000,
    },
    channels: {},
  };
  writeFileSync(paths.config, JSON.stringify(config, null, 2));

  // Create empty .env template
  const envTemplate = `# Promptty Instance Configuration
# Uncomment and fill in the credentials for your platform(s)

# Slack Configuration
# SLACK_APP_TOKEN=xapp-1-...
# SLACK_BOT_TOKEN=xoxb-...
# SLACK_SIGNING_SECRET=

# Teams Configuration
# TEAMS_APP_ID=
# TEAMS_APP_PASSWORD=

# General Settings
LOG_LEVEL=info
CALLBACK_PORT=3001
`;
  writeFileSync(paths.env, envTemplate);
}

function writeConfigFiles(
  paths: ReturnType<typeof resolveInstance>,
  data: InitFormData
): void {
  // Build channels config
  const channels: Record<string, { workingDirectory: string; responseFilter?: { mode: string } }> = {};
  if (data.channel) {
    channels[data.channel.key] = {
      workingDirectory: data.channel.workingDirectory,
      responseFilter: { mode: 'mentions' },
    };
  }

  // Create config.json
  const config = {
    defaults: {
      command: 'claude',
      sessionTTL: 14400000,
    },
    channels,
  };
  writeFileSync(paths.config, JSON.stringify(config, null, 2));

  // Create .env file
  const envLines: string[] = ['# Promptty Instance Configuration', ''];

  if (data.slack) {
    envLines.push('# Slack Configuration');
    envLines.push(`SLACK_APP_TOKEN=${data.slack.appToken}`);
    envLines.push(`SLACK_BOT_TOKEN=${data.slack.botToken}`);
    if (data.slack.signingSecret) {
      envLines.push(`SLACK_SIGNING_SECRET=${data.slack.signingSecret}`);
    }
    envLines.push('');
  }

  if (data.teams) {
    envLines.push('# Teams Configuration');
    envLines.push(`TEAMS_APP_ID=${data.teams.appId}`);
    envLines.push(`TEAMS_APP_PASSWORD=${data.teams.appPassword}`);
    envLines.push('');
  }

  envLines.push('# General Settings');
  envLines.push('LOG_LEVEL=info');
  envLines.push('CALLBACK_PORT=3001');

  writeFileSync(paths.env, envLines.join('\n'));
}
