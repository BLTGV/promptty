---
name: Promptty Setup Check
description: Check and validate Promptty configuration in a Claude Code instance
---

# Promptty Setup Check

This skill helps verify that Promptty is properly configured and the MCP connection is working.

## Quick Diagnostics

When asked to check promptty setup, perform these steps:

### 1. Check Environment Variables

Look for these environment variables:
- `PROMPTTY_SESSION_ID` - Should be set when running via Promptty
- `PROMPTTY_CALLBACK_URL` - URL of the callback server (default: http://127.0.0.1:3001)

### 2. Test MCP Connection

Try calling the `list_channels` tool:

```javascript
list_channels()
```

**Expected results:**
- Success: Returns a list of configured channels
- "No session ID available": PROMPTTY_SESSION_ID not set - this is normal when not running via Promptty
- Connection refused: The Promptty callback server is not running

### 3. Test Update Delivery

If list_channels works, test sending an update:

```javascript
post_update(message="Testing promptty connection", type="progress")
```

## Common Issues

### "No session ID available"
- **Cause**: Claude Code wasn't started via Promptty
- **Fix**: This is expected when running Claude Code directly. Updates only work when triggered from Slack/Teams.

### "Connection refused" or network error
- **Cause**: Promptty server is not running
- **Fix**: Start the Promptty server with `bun run start` in the promptty directory

### "Session not found or inactive"
- **Cause**: The session has expired or the session ID is invalid
- **Fix**: The session may have timed out. Ask the user to send a new message in Slack/Teams.

## Verifying Full Setup

For a complete setup verification:

1. **Check Promptty server is running**: Should see "Callback server started" in logs
2. **Check Slack/Teams adapter**: Should see "Slack app started" or "Teams bot server started"
3. **Check MCP server**: Should see successful tool responses

## Configuration File Check

Promptty uses `config.json` for channel configuration. Key settings:

```json
{
  "channels": {
    "slack:WORKSPACE_ID/CHANNEL_ID": {
      "workingDirectory": "/path/to/project",
      "responseFilter": {
        "mode": "mentions"  // all, mentions, keywords, regex, threads, none
      }
    }
  }
}
```

### Response Filter Modes

- `all` - Respond to all messages (not recommended)
- `mentions` - Only respond when @mentioned (default)
- `keywords` - Respond when message contains specific keywords
- `regex` - Respond when message matches patterns
- `threads` - Only respond in threads
- `none` - Don't respond (channel disabled)
