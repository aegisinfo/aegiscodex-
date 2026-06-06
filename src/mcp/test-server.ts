#!/usr/bin/env node
/**
 * 
 * 
 * 
 * 
 * 
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  {
    name: 'test-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'echo',
        description: 'Echo back the input text',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Text to echo',
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'time',
        description: 'Get current time',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'echo') {
    const text = (args as { text?: string })?.text || '';
    return {
      content: [{ type: 'text', text: `Echo: ${text}` }],
    };
  }

  if (name === 'time') {
    return {
      content: [{ type: 'text', text: `Current time: ${new Date().toISOString()}` }],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Test MCP server running on stdio');
}

main().catch(console.error);
