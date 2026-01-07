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

# Ensure ~/.bun/bin is in PATH (if not already)
export PATH="$HOME/.bun/bin:$PATH"

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

Ensure `~/.bun/bin` is in your PATH:
```bash
# Add to ~/.bashrc or ~/.zshrc if not already present
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

After linking, you can use:
```bash
promptty --help
promptty init <instance>
promptty serve <instance>
promptty list
promptty config show <instance>
promptty service status <instance>
promptty mcp status <instance>
```

Without linking, prefix commands with `bun run src/cli/index.ts`:
```bash
bun run src/cli/index.ts serve <instance>
```

### Shell Completions (Optional)

Enable tab completion for promptty commands and instance names.

**Bash:**
```bash
# Add to ~/.bashrc
source /path/to/promptty/completions/promptty.bash

# Or copy to system completions
sudo cp /path/to/promptty/completions/promptty.bash /etc/bash_completion.d/promptty
```

**Zsh:**
```bash
# Option 1: Source directly in ~/.zshrc
source /path/to/promptty/completions/promptty.zsh

# Option 2: Add to fpath (before compinit)
fpath=(/path/to/promptty/completions $fpath)
autoload -Uz compinit && compinit
```

**Fish:**
```bash
# Copy to fish completions directory
cp /path/to/promptty/completions/promptty.fish ~/.config/fish/completions/
```

After installation, you can tab-complete:
- Commands: `promptty ser<TAB>` → `promptty serve`
- Subcommands: `promptty service st<TAB>` → `promptty service start` or `status`
- Instance names: `promptty serve my-<TAB>` → `promptty serve my-instance`

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

## 10. MCP Server (Progress Updates)

The MCP server allows Claude Code to send progress updates back to the chat during long-running tasks. This is optional but highly recommended for better user experience.

### What the MCP Server Provides

When installed, Claude Code gets access to these tools:

| Tool | Description |
|------|-------------|
| `post_update` | Send progress messages to the current chat thread |
| `send_message` | Send messages to other channels |
| `list_channels` | List available channels |

### Prerequisites

1. **Working Directory Required**: The MCP server is installed per working directory. Your config must have `workingDirectory` set:

```json
{
  "defaults": {
    "workingDirectory": "/home/deploy/projects/default",
    "command": "claude"
  },
  "channels": {
    "slack:T123/C456": {
      "workingDirectory": "/home/deploy/projects/specific-project"
    }
  }
}
```

2. **Callback Port**: Ensure `CALLBACK_PORT` is set in your `.env` (default: `3001`):

```env
CALLBACK_PORT=3001
```

### Installing the MCP Server

```bash
# Check current status
promptty mcp status <instance>

# Install to all configured working directories
promptty mcp install <instance>

# Install with custom callback port
promptty mcp install <instance> --callback-port 3002
```

This creates/updates `.mcp.json` in each working directory with the promptty MCP server configuration.

### Verifying Installation

```bash
# Check status after installation
promptty mcp status acme-corp
```

Expected output:
```
MCP server status for acme-corp:

  ✓ /home/deploy/projects/default
  ✓ /home/deploy/projects/specific-project
```

### How It Works

1. When Promptty receives a message, it spawns Claude Code in the configured working directory
2. Claude Code reads `.mcp.json` and starts the promptty MCP server
3. During execution, Claude can call `post_update` to send progress messages
4. Promptty's callback server receives these and posts them to the chat thread

### Example Flow

User asks: "Deploy the new version to production"

Claude can send progress updates like:
- "🔄 Running tests..."
- "✅ Tests passed, building Docker image..."
- "🚀 Deploying to production cluster..."
- "✅ Deployment complete!"

### Removing the MCP Server

```bash
# Remove from all working directories
promptty mcp uninstall <instance>
```

This removes the `promptty` entry from `.mcp.json` files (preserves other MCP servers if configured).

### Manual Configuration

If you prefer manual setup, create `.mcp.json` in your working directory:

```json
{
  "mcpServers": {
    "promptty": {
      "command": "/home/user/.bun/bin/bun",
      "args": ["run", "/path/to/promptty/mcp-server/index.ts"],
      "env": {
        "PROMPTTY_CALLBACK_URL": "http://127.0.0.1:3001"
      }
    }
  }
}
```

Adjust paths to match your Bun and Promptty installation locations.

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

### MCP server not working / No progress updates
- Verify working directory is configured: `promptty config show <instance>`
- Check MCP installation status: `promptty mcp status <instance>`
- Ensure callback port matches: check `CALLBACK_PORT` in `.env`
- Verify `.mcp.json` exists in the working directory
- Check that Bun path in `.mcp.json` is correct (run `which bun`)

### "No working directories configured"
- Add `workingDirectory` to your config.json defaults or channel config
- The directory must exist on disk

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
