#!/usr/bin/env node
/**
 * MCP Server for Promptty callbacks
 *
 * This MCP server provides tools for Claude Code to send updates
 * back to the chat channel during execution.
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
    version: '0.1.0',
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
          'Send a progress update to the chat channel. Use this to keep the user informed during long-running tasks. Types: "progress" (default), "warning", "success", "error".',
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
              description: 'The type of update',
            },
          },
          required: ['message'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

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
