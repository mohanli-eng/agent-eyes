#!/usr/bin/env node
/**
 * browser-eyes-mcp server entry point.
 *
 * Registers 6 tools and starts MCP server over stdio transport.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import {
  GetConsoleErrorsInputSchema,
  OpenSessionInputSchema,
  CloseSessionInputSchema,
  GetNetworkRequestsInputSchema,
  GetDOMSnapshotInputSchema,
  GetPerfMetricsInputSchema,
} from './types.js';
import { openSession } from './tools/open-session.js';
import { closeSession } from './tools/close-session.js';
import { getConsoleErrors } from './tools/get-console-errors.js';
import { getNetworkRequests } from './tools/get-network-requests.js';
import { getDOMSnapshot } from './tools/get-dom-snapshot.js';
import { getPerfMetrics } from './tools/get-perf-metrics.js';

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

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'openSession',
        description:
          'Open a URL in headless Chromium, mount all observers (console, network, DOM, perf), ' +
          'and return a sessionId. The browser stays alive for subsequent queries. ' +
          'Call closeSession when done to release resources.',
        inputSchema: zodToJsonSchema(OpenSessionInputSchema) as object,
      },
      {
        name: 'closeSession',
        description:
          'Close a browser session previously opened with openSession. ' +
          'Releases the Chromium process. Returns success: false if the session was already closed.',
        inputSchema: zodToJsonSchema(CloseSessionInputSchema) as object,
      },
      {
        name: 'getConsoleErrors',
        description:
          'Open a URL in headless Chromium, wait for the page to settle, ' +
          'and return a compressed report of all console errors and warnings ' +
          'observed during that window. Output is deduplicated and ' +
          'token-truncated to fit cleanly into agent context windows. ' +
          'Supports session mode (pass sessionId) or one-shot mode (pass url).',
        inputSchema: zodToJsonSchema(GetConsoleErrorsInputSchema) as object,
      },
      {
        name: 'getNetworkRequests',
        description:
          'Capture all network requests during page load, identify failed requests (4xx/5xx) ' +
          'and slow requests (over threshold). Group by URL pattern. ' +
          'Supports session mode (pass sessionId) or one-shot mode (pass url).',
        inputSchema: zodToJsonSchema(GetNetworkRequestsInputSchema) as object,
      },
      {
        name: 'getDOMSnapshot',
        description:
          'Extract a semantic DOM snapshot of the page: headings, buttons, inputs, links, ' +
          'and role elements. Excludes script/style/comments/hidden elements. ' +
          'Optional CSS selector to scope the snapshot. ' +
          'Supports session mode (pass sessionId) or one-shot mode (pass url).',
        inputSchema: zodToJsonSchema(GetDOMSnapshotInputSchema) as object,
      },
      {
        name: 'getPerfMetrics',
        description:
          'Collect Core Web Vitals (LCP, CLS, TBT) and resource load timings. ' +
          'Returns ratings (good/needs-improvement/poor) following web.dev thresholds. ' +
          'Supports session mode (pass sessionId) or one-shot mode (pass url).',
        inputSchema: zodToJsonSchema(GetPerfMetricsInputSchema) as object,
      },
    ],
  };
});

// ---------------------------------------------------------------------------
// Tool dispatch
// ---------------------------------------------------------------------------

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'openSession': {
        const parsed = OpenSessionInputSchema.parse(args);
        const result = await openSession(parsed);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }
      case 'closeSession': {
        const parsed = CloseSessionInputSchema.parse(args);
        const result = await closeSession(parsed);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }
      case 'getConsoleErrors': {
        const parsed = GetConsoleErrorsInputSchema.parse(args);
        const result = await getConsoleErrors(parsed);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }
      case 'getNetworkRequests': {
        const parsed = GetNetworkRequestsInputSchema.parse(args);
        const result = await getNetworkRequests(parsed);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }
      case 'getDOMSnapshot': {
        const parsed = GetDOMSnapshotInputSchema.parse(args);
        const result = await getDOMSnapshot(parsed);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }
      case 'getPerfMetrics': {
        const parsed = GetPerfMetricsInputSchema.parse(args);
        const result = await getPerfMetrics(parsed);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [{ type: 'text', text: `Tool execution failed: ${message}` }],
    };
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

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
