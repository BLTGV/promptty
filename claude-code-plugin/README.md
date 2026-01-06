# Promptty Claude Code Plugin

This plugin integrates Claude Code with [Promptty](https://github.com/anthropics/promptty), enabling bidirectional communication between Claude Code and Slack/Teams channels.

## Features

- **Progress Updates**: Send status updates to the chat channel during long-running tasks
- **Cross-Channel Messaging**: Post to different channels or outside the current thread
- **Channel Awareness**: List and interact with configured channels
- **Configuration Guidance**: Built-in skills for setup verification

## Installation

### Option 1: Install from Git URL (Recommended)

```bash
/plugin install https://github.com/anthropics/promptty/tree/main/claude-code-plugin
```

Or using the CLI:
```bash
claude plugin install https://github.com/anthropics/promptty/tree/main/claude-code-plugin
```

### Option 2: Install from Local Directory

If you have Promptty cloned locally:

```bash
/plugin install /path/to/promptty/claude-code-plugin
```

### Option 3: Manual Installation

1. Clone the Promptty repository:
   ```bash
   git clone https://github.com/anthropics/promptty.git
   ```

2. Copy the plugin to your Claude Code plugins directory:
   ```bash
   cp -r promptty/claude-code-plugin ~/.claude/plugins/promptty
   ```

3. Restart Claude Code

## Available Tools

### post_update
Send a progress message to the current chat thread.

```javascript
post_update(message="Status update here", type="progress")
```

Types: `progress`, `warning`, `success`, `error`

### send_message
Send a message to any channel the bot has access to.

```javascript
send_message(
  platform="slack",  // or "teams"
  channel_id="C0123456789",
  message="Your message",
  thread_ts="optional-thread-id"  // Slack only
)
```

### list_channels
List channels available for cross-posting.

```javascript
list_channels()
```

## Usage

When Claude Code is invoked via Promptty (from Slack/Teams), the environment variables `PROMPTTY_SESSION_ID` and `PROMPTTY_CALLBACK_URL` are automatically set, enabling the tools.

### Best Practices

1. **Send meaningful updates**: Keep users informed during long operations
2. **Rate limit updates**: Don't spam - wait at least 30 seconds between updates
3. **Use appropriate types**: Use `warning` for issues, `success` for completions, `error` for failures
4. **Be concise**: Keep messages short and informative

## Skills

The plugin includes skills for guidance:

- **chat-updates**: How to send progress updates effectively
- **setup-check**: Diagnose configuration issues

## Requirements

- Claude Code >= 1.0.0
- Bun runtime (for the MCP server)
- Running Promptty server

## Configuration

The plugin automatically connects to Promptty when running via Slack/Teams. No manual configuration is needed beyond installing the plugin.

For Promptty server configuration, see the [main Promptty documentation](https://github.com/anthropics/promptty).
