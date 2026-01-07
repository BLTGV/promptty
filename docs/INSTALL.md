# Promptty Installation Guide

Complete setup guide for installing Promptty on a fresh server.

## Quick Start

If you already have Bun and Claude CLI installed:

```bash
# Clone and install
git clone https://github.com/BLTGV/promptty.git
cd promptty && bun install

# Link globally (optional but recommended)
bun link

# Initialize an instance
promptty init my-workspace
# Follow interactive prompts for Slack credentials

# Start the server
promptty serve my-workspace
```

## Prerequisites

- Linux server (Ubuntu/Debian recommended)
- Bun runtime
- Claude CLI installed and authenticated
- Slack workspace admin access

## 1. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc  # or restart shell
```

Verify installation:
```bash
bun --version
```

## 2. Install Claude CLI

Follow the official Claude Code installation instructions to install and authenticate the `claude` CLI.

Verify installation:
```bash
claude --version
```

## 3. Clone and Install Promptty

```bash
git clone https://github.com/BLTGV/promptty.git
cd promptty
bun install
```

### Global CLI Installation (Optional)

Link the CLI globally to use `promptty` command from anywhere:

```bash
cd promptty
bun link
```

After linking, you can use:
```bash
promptty --help
promptty init <instance>
promptty serve <instance>
promptty config show <instance>
promptty service status <instance>
```

Without linking, prefix commands with `bun run src/cli/index.ts`:
```bash
bun run src/cli/index.ts serve <instance>
```

## 4. Create a Slack App

1. Go to https://api.slack.com/apps
2. Click **Create New App** → **From scratch**
3. Name it (e.g., "Promptty") and select your workspace

### Enable Socket Mode

1. Go to **Settings** → **Socket Mode**
2. Toggle **Enable Socket Mode** to On
3. Click **Generate** to create an App-Level Token
4. Name it (e.g., "promptty-socket") and add the `connections:write` scope
5. Copy the token (starts with `xapp-`)

### Add Bot Token Scopes

1. Go to **Features** → **OAuth & Permissions**
2. Under **Bot Token Scopes**, add:
   - `app_mentions:read` - Receive @mention events
   - `channels:history` - Read channel messages
   - `channels:read` - View channel info
   - `chat:write` - Send messages
   - `groups:history` - Read private channel messages
   - `groups:read` - View private channel info
   - `im:history` - Read DM messages (for DM support)
   - `im:read` - View DM info (for DM support)
   - `users:read` - View user info

### Subscribe to Events

1. Go to **Features** → **Event Subscriptions**
2. Toggle **Enable Events** to On
3. Under **Subscribe to bot events**, add:
   - `app_mention` - When someone @mentions the bot
   - `message.channels` - Messages in public channels
   - `message.groups` - Messages in private channels
   - `message.im` - Direct messages (for DM support)

### Install to Workspace

1. Go to **Settings** → **Install App**
2. Click **Install to Workspace** and authorize
3. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

## 5. Initialize a Promptty Instance

Each customer/project gets its own instance with isolated configuration.

```bash
# Interactive setup
bun run src/cli/index.ts init acme-corp

# Or non-interactive (create empty config to edit manually)
bun run src/cli/index.ts init acme-corp --no-interactive
```

### Configure Credentials

Edit `~/.promptty/instances/acme-corp/.env`:

```bash
nano ~/.promptty/instances/acme-corp/.env
```

```env
# Slack Configuration
SLACK_APP_TOKEN=xapp-1-A0123456789-0123456789012-abcdef...
SLACK_BOT_TOKEN=xoxb-0123456789-0123456789012-abcdef...

# Optional
SLACK_SIGNING_SECRET=your-signing-secret

# General Settings
LOG_LEVEL=info
CALLBACK_PORT=3001
```

### Configure Channels

Edit `~/.promptty/instances/acme-corp/config.json`:

```bash
nano ~/.promptty/instances/acme-corp/config.json
```

```json
{
  "defaults": {
    "workingDirectory": "/home/deploy/projects/default",
    "command": "claude",
    "skipPermissions": true,
    "responseFilter": {
      "mode": "mentions",
      "allowDMs": true
    }
  },
  "channels": {}
}
```

#### Finding Channel IDs

To configure specific channels, you need the workspace and channel IDs:

1. In Slack, right-click on a channel → **Copy link**
2. The URL format is: `https://workspace.slack.com/archives/C0123456789`
3. The channel ID is `C0123456789`
4. Find workspace ID in the URL when viewing the channel: `https://app.slack.com/client/T0AN32YJH/C0123456789`
5. The workspace ID is `T0AN32YJH`

Add to config:
```json
{
  "channels": {
    "slack:T0AN32YJH/C0123456789": {
      "workingDirectory": "/home/deploy/projects/specific-project",
      "responseFilter": {
        "mode": "mentions",
        "allowDMs": true
      }
    }
  }
}
```

## 6. Test the Setup

```bash
bun run src/cli/index.ts serve acme-corp
```

You should see:
```
INFO Starting Promptty
INFO Slack app started
INFO Promptty started successfully
```

Test by:
- **@mentioning** the bot in a channel it's been added to
- **DMing** the bot directly (if `allowDMs: true`)

Press `Ctrl+C` to stop.

## 7. Install as Systemd Service

For production, run Promptty as a systemd user service:

```bash
# Install the service file
bun run src/cli/index.ts service install acme-corp

# Enable auto-start on boot
bun run src/cli/index.ts service enable acme-corp

# Start the service
bun run src/cli/index.ts service start acme-corp
```

### Service Management Commands

```bash
# Check status
bun run src/cli/index.ts service status acme-corp

# View logs
bun run src/cli/index.ts service logs acme-corp

# Follow logs in real-time
bun run src/cli/index.ts service logs acme-corp -f

# Restart after config changes
bun run src/cli/index.ts service restart acme-corp

# Stop the service
bun run src/cli/index.ts service stop acme-corp

# Disable auto-start
bun run src/cli/index.ts service disable acme-corp

# Uninstall the service
bun run src/cli/index.ts service uninstall acme-corp
```

## 8. Multi-Tenant Setup

Run multiple instances for different customers on the same server:

```bash
# Create instances
bun run src/cli/index.ts init customer-a --no-interactive
bun run src/cli/index.ts init customer-b --no-interactive
bun run src/cli/index.ts init customer-c --no-interactive

# Configure each (different Slack apps, different projects)
nano ~/.promptty/instances/customer-a/.env
nano ~/.promptty/instances/customer-b/.env
nano ~/.promptty/instances/customer-c/.env

# Install services for each
bun run src/cli/index.ts service install customer-a
bun run src/cli/index.ts service install customer-b
bun run src/cli/index.ts service install customer-c

# Enable and start all
for i in customer-a customer-b customer-c; do
  bun run src/cli/index.ts service enable $i
  bun run src/cli/index.ts service start $i
done

# List all services
bun run src/cli/index.ts service list
```

Each instance:
- Has its own Slack app credentials
- Has its own config and working directories
- Runs as a separate systemd service
- Uses a different callback port (configure in `.env`)

## 9. Response Filter Modes

Control when the bot responds:

| Mode | Behavior |
|------|----------|
| `mentions` | Only respond to @mentions (default) |
| `all` | Respond to all messages (not recommended) |
| `keywords` | Respond when message contains specific keywords |
| `threads` | Only respond in threads |
| `none` | Disabled - don't respond |

Example with keywords:
```json
{
  "responseFilter": {
    "mode": "keywords",
    "keywords": ["help", "claude", "deploy"],
    "allowDMs": true
  }
}
```

## Troubleshooting

### "Slack adapter not configured"
- Check that `SLACK_APP_TOKEN` and `SLACK_BOT_TOKEN` are set in `.env`

### Bot doesn't respond to messages
- Verify the bot is added to the channel
- Check response filter mode (default is `mentions` - requires @mention)
- Check logs: `bun run src/cli/index.ts service logs <instance> -f`

### "Session not found"
- Sessions expire after 4 hours by default
- Start a new conversation by @mentioning again

### Permission denied
- Ensure Claude CLI is authenticated: `claude auth`
- Check `workingDirectory` exists and is accessible

### Service won't start
- Check logs: `journalctl --user -u promptty-<instance> -f`
- Verify Bun is in PATH for systemd: may need full path in service file

## Development

### Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage

# Run specific test file
bun test src/cli/utils/instance.test.ts
```

### Type Checking

```bash
bun run typecheck
```
