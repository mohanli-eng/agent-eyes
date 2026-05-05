#!/usr/bin/env node
/**
 * browser-eyes-mcp server entry point.
 *
 * Registers tools and starts MCP server over stdio transport.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { GetConsoleErrorsInputSchema } from './types.js';
import { getConsoleErrors } from './tools/get-console-errors.js';

const server = new Server(
  {
    name: 'browser-eyes-mcp',
    version: '0.0.1',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// ----------------------------------------------------------------------------
// Tool registration
// ----------------------------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'getConsoleErrors',
        description:
          'Open a URL in headless Chromium, wait for the page to settle, ' +
          'and return a compressed report of all console errors and warnings ' +
          'observed during that window. Output is deduplicated and ' +
          'token-truncated to fit cleanly into agent context windows.',
        inputSchema: zodToJsonSchema(GetConsoleErrorsInputSchema) as object,
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'getConsoleErrors') {
      const parsed = GetConsoleErrorsInputSchema.parse(args);
      const result = await getConsoleErrors(parsed);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [{ type: 'text', text: `Tool execution failed: ${message}` }],
    };
  }
});

// ----------------------------------------------------------------------------
// Start
// ----------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console
  console.error('[browser-eyes-mcp] Server started on stdio');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[browser-eyes-mcp] Fatal error:', err);
  process.exit(1);
});
