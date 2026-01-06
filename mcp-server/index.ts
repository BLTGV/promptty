#!/usr/bin/env node
/**
 * MCP Server for Promptty callbacks
 *
 * This MCP server provides tools for Claude Code to send updates
 * back to the chat channel during execution, and to send messages
 * to other channels.
 *
 * Environment variables:
 * - PROMPTTY_SESSION_ID: The session ID for callbacks
 * - PROMPTTY_CALLBACK_URL: The callback server URL (default: http://127.0.0.1:3001)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const SESSION_ID = process.env.PROMPTTY_SESSION_ID ?? '';
const CALLBACK_URL = process.env.PROMPTTY_CALLBACK_URL ?? 'http://127.0.0.1:3001';

const server = new Server(
  {
    name: 'promptty',
    version: '0.2.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'post_update',
        description:
          'Send a progress update to the current chat thread. Use this to keep the user informed during long-running tasks. This posts to the same thread where the conversation started.',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The message to send (keep under 500 characters)',
            },
            type: {
              type: 'string',
              enum: ['progress', 'warning', 'success', 'error'],
              default: 'progress',
              description: 'The type of update: progress (informational), warning (attention needed), success (task completed), error (something failed)',
            },
          },
          required: ['message'],
        },
      },
      {
        name: 'send_message',
        description:
          'Send a message to a specific channel. Use this to post updates to a different channel than the one where the conversation started, or to post outside of the current thread. Requires the channel to be configured in promptty.',
        inputSchema: {
          type: 'object',
          properties: {
            platform: {
              type: 'string',
              enum: ['slack', 'teams'],
              description: 'The platform to send to (slack or teams)',
            },
            channel_id: {
              type: 'string',
              description: 'The channel ID to send to (e.g., C0123456789 for Slack)',
            },
            message: {
              type: 'string',
              description: 'The message to send',
            },
            thread_ts: {
              type: 'string',
              description: 'Optional: Thread timestamp to reply in a specific thread (Slack only)',
            },
            workspace_id: {
              type: 'string',
              description: 'Optional: Workspace ID for multi-workspace Slack setups',
            },
          },
          required: ['platform', 'channel_id', 'message'],
        },
      },
      {
        name: 'list_channels',
        description:
          'List available channels that promptty can send messages to. Returns both configured channels and any channels the bot has interacted with.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Post update to current thread
  if (name === 'post_update') {
    const message = (args as { message: string; type?: string }).message;
    const type = (args as { message: string; type?: string }).type ?? 'progress';

    if (!SESSION_ID) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: No session ID available. Cannot send update.',
          },
        ],
        isError: true,
      };
    }

    try {
      const response = await fetch(`${CALLBACK_URL}/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: SESSION_ID,
          message,
          type,
        }),
      });

      if (response.ok) {
        return {
          content: [
            {
              type: 'text',
              text: `Update sent: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
            },
          ],
        };
      } else {
        const error = await response.text();
        return {
          content: [
            {
              type: 'text',
              text: `Failed to send update: ${error}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error sending update: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  // Send message to a specific channel
  if (name === 'send_message') {
    const { platform, channel_id, message, thread_ts, workspace_id } = args as {
      platform: 'slack' | 'teams';
      channel_id: string;
      message: string;
      thread_ts?: string;
      workspace_id?: string;
    };

    if (!SESSION_ID) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: No session ID available. Cannot send message.',
          },
        ],
        isError: true,
      };
    }

    try {
      const response = await fetch(`${CALLBACK_URL}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: SESSION_ID,
          platform,
          channel_id,
          message,
          thread_ts,
          workspace_id,
        }),
      });

      const result = await response.json() as { success?: boolean; messageId?: string; threadTs?: string; error?: string };

      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Message sent to ${platform} channel ${channel_id}${result.threadTs ? ` (thread: ${result.threadTs})` : ''}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to send message: ${result.error ?? 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error sending message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  // List available channels
  if (name === 'list_channels') {
    if (!SESSION_ID) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: No session ID available. Cannot list channels.',
          },
        ],
        isError: true,
      };
    }

    try {
      const response = await fetch(`${CALLBACK_URL}/channels?session_id=${SESSION_ID}`, {
        method: 'GET',
      });

      const result = await response.json() as {
        channels?: Array<{
          platform: string;
          channelId: string;
          name?: string;
          workspaceId?: string;
          configured: boolean;
        }>;
        error?: string;
      };

      if (result.channels) {
        const channelList = result.channels.map(ch =>
          `- ${ch.platform}: ${ch.name ?? ch.channelId} (${ch.channelId})${ch.configured ? ' [configured]' : ''}`
        ).join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `Available channels:\n${channelList || 'No channels found'}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to list channels: ${result.error ?? 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing channels: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: `Unknown tool: ${name}`,
      },
    ],
    isError: true,
  };
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Promptty MCP server started');
}

main().catch(console.error);
