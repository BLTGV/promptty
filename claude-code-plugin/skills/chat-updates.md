---
name: Chat Channel Updates
description: Send progress updates to Slack/Teams chat channels during long-running tasks
---

# Chat Channel Updates

When running via Promptty, you can send progress updates to the user's chat channel during long-running tasks using the MCP tools.

## Available Tools

### post_update
Send a message to the current conversation thread.

```javascript
post_update(message="Your progress message here", type="progress")
```

**Types:**
- `progress` (default) - General progress updates
- `warning` - Something unexpected but non-blocking
- `success` - A milestone was achieved
- `error` - Something went wrong but you're handling it

### send_message
Send a message to a different channel or outside the current thread.

```javascript
send_message(
  platform="slack",
  channel_id="C0123456789",
  message="Cross-channel update",
  thread_ts="optional-thread-timestamp"
)
```

### list_channels
List available channels you can send messages to.

```javascript
list_channels()
```

## When to Send Updates

**DO send updates when:**
- Starting a significant phase of work (e.g., "Analyzing 50 test files...")
- Completing a major milestone (e.g., "All tests passing. Starting deployment...")
- Encountering issues that might take time to resolve (e.g., "Found deprecated API, updating...")
- You have useful partial results worth sharing immediately
- You find a file or resource the user should see right away

**DON'T send updates for:**
- Every small file read or edit
- Quick operations under 10 seconds
- Internal reasoning steps
- Very frequent updates (wait at least 30 seconds between updates)

## Examples

```javascript
// Starting analysis
post_update(message="Found 23 test files. Running test suite now...", type="progress")

// Share a finding immediately
post_update(message="Found the bug in src/auth.ts:142 - incorrect token validation. Fixing now.", type="progress")

// Warning about something
post_update(message="Package.json has outdated dependencies. Will update as part of fix.", type="warning")

// Success milestone
post_update(message="All 47 tests passing. PR ready for review.", type="success")

// Error being handled
post_update(message="Build failed on first attempt. Retrying with clean cache.", type="error")

// Cross-channel notification
send_message(platform="slack", channel_id="C0ALERTS", message="Deployment to staging completed successfully")
```

## Guidelines

1. **Be concise** - Keep messages to 1-3 sentences
2. **Be informative** - Include specific numbers/details when relevant
3. **Rate limit** - No more than 1 update per 30 seconds
4. **Share findings** - Link files or share code snippets when useful
5. **Final summary** - Always send a success update when completing the main task
