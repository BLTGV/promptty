# Chat Channel Updates

You can send progress updates to the user's chat channel during long-running tasks using the `post_update` MCP tool.

## When to Send Updates

**DO send updates when:**
- Starting a significant phase of work (e.g., "Analyzing 50 test files...")
- Completing a major milestone (e.g., "All tests passing. Starting deployment...")
- Encountering issues that might take time to resolve (e.g., "Found deprecated API, updating...")
- You have useful partial results worth sharing immediately

**DON'T send updates for:**
- Every small file read or edit
- Quick operations under 10 seconds
- Internal reasoning steps
- Very frequent updates (wait at least 30 seconds between updates)

## How to Use

Call the `post_update` tool with your message:

```
post_update(message="Your progress message here", type="progress")
```

### Update Types

- `progress` (default) - General progress updates
- `warning` - Something unexpected but non-blocking
- `success` - A milestone was achieved
- `error` - Something went wrong but you're handling it

## Examples

```
// Starting analysis
post_update(message="Found 23 test files. Running test suite now...", type="progress")

// Warning about something
post_update(message="Package.json has outdated dependencies. Will update as part of fix.", type="warning")

// Success milestone
post_update(message="All 47 tests passing. PR ready for review.", type="success")

// Error being handled
post_update(message="Build failed on first attempt. Retrying with clean cache.", type="error")
```

## Guidelines

1. **Be concise** - Keep messages to 1-3 sentences
2. **Be informative** - Include specific numbers/details when relevant
3. **Rate limit** - No more than 1 update per 30 seconds
4. **Final summary** - Always send a success update when completing the main task
