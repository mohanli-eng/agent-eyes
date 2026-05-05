/**
 * Shared types for browser-eyes-mcp
 */

import { z } from 'zod';

// ============================================================================
// getConsoleErrors
// ============================================================================

export const GetConsoleErrorsInputSchema = z.object({
  url: z.string().url().describe('Public HTTPS URL to observe'),
  waitMs: z
    .number()
    .int()
    .min(0)
    .max(30000)
    .default(5000)
    .describe('How long to observe after page load (default 5000ms)'),
  includeWarnings: z
    .boolean()
    .default(false)
    .describe('Include level=warning in output (default false)'),
  maxTokens: z
    .number()
    .int()
    .min(200)
    .max(10000)
    .default(2000)
    .describe('Output token budget (default 2000)'),
});

export type GetConsoleErrorsInput = z.infer<typeof GetConsoleErrorsInputSchema>;

export interface UniqueError {
  level: 'error' | 'warning';
  message: string;
  source?: string;
  count: number;
  firstSeenMs: number;
}

export interface GetConsoleErrorsOutput {
  url: string;
  observedFor: number;
  totalErrors: number;
  totalWarnings: number;
  uniqueErrors: UniqueError[];
  truncated: boolean;
  notes?: string[];
}

export interface GetConsoleErrorsError {
  error: 'NETWORK_ERROR' | 'TIMEOUT' | 'CRASH' | 'INVALID_URL';
  message: string;
}
