/**
 * Shared types for browser-eyes-mcp
 */

import { z } from 'zod';

// ============================================================================
// getConsoleErrors
// ============================================================================

export const GetConsoleErrorsInputSchema = z
  .object({
    sessionId: z.string().optional().describe('Query an existing session by ID'),
    url: z
      .string()
      .url()
      .optional()
      .describe('Public URL to observe (one-shot mode, mutually exclusive with sessionId)'),
    waitMs: z
      .number()
      .int()
      .min(0)
      .max(30000)
      .default(5000)
      .describe('How long to observe after page load (default 5000ms, one-shot mode only)'),
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
  })
  .refine((data) => data.sessionId || data.url, {
    message: 'Must provide either sessionId or url',
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
  error: 'NETWORK_ERROR' | 'TIMEOUT' | 'CRASH' | 'INVALID_URL' | 'SESSION_NOT_FOUND';
  message: string;
}

// ============================================================================
// openSession
// ============================================================================

export const OpenSessionInputSchema = z.object({
  url: z.string().url().describe('Public HTTPS URL to observe'),
});

export type OpenSessionInput = z.infer<typeof OpenSessionInputSchema>;

export interface OpenSessionOutput {
  sessionId: string;
  url: string;
  pageTitle?: string;
}

export interface OpenSessionError {
  error: 'NETWORK_ERROR' | 'TIMEOUT' | 'CRASH' | 'INVALID_URL' | 'AUTH_NOT_SUPPORTED';
  message: string;
}

// ============================================================================
// closeSession
// ============================================================================

export const CloseSessionInputSchema = z.object({
  sessionId: z.string().describe('Session ID to close'),
});

export type CloseSessionInput = z.infer<typeof CloseSessionInputSchema>;

export interface CloseSessionOutput {
  success: boolean;
  reason?: string;
}

// ============================================================================
// getNetworkRequests
// ============================================================================

export const GetNetworkRequestsInputSchema = z.object({
  sessionId: z.string().optional().describe('Query an existing session by ID'),
  url: z.string().url().optional().describe('Public URL to observe (one-shot mode)'),
  waitMs: z
    .number()
    .int()
    .min(0)
    .max(30000)
    .default(5000)
    .describe('Extra observation time after load (one-shot mode only)'),
  slowThresholdMs: z
    .number()
    .int()
    .min(1)
    .max(60000)
    .default(1000)
    .describe('Requests slower than this (ms) are flagged as slow'),
  maxTokens: z
    .number()
    .int()
    .min(200)
    .max(10000)
    .default(2000)
    .describe('Output token budget'),
});

export type GetNetworkRequestsInput = z.infer<typeof GetNetworkRequestsInputSchema>;

export interface FailedRequest {
  url: string;
  method: string;
  status: number;
  statusText: string;
  durationMs: number;
  type?: string;
}

export interface SlowRequest {
  url: string;
  method: string;
  status: number;
  durationMs: number;
  type?: string;
}

export interface RedirectEntry {
  from: string;
  to: string;
  status: number;
}

export interface GroupedByPattern {
  pattern: string;
  count: number;
  avgDurationMs: number;
  errorRate: number;
}

export interface GetNetworkRequestsOutput {
  url: string;
  observedFor: number;
  totalRequests: number;
  failedRequests: FailedRequest[];
  slowRequests: SlowRequest[];
  redirects: RedirectEntry[];
  groupedByPattern: GroupedByPattern[];
  truncated: boolean;
  notes?: string[];
}

export type GetNetworkRequestsError = GetConsoleErrorsError;

// ============================================================================
// getDOMSnapshot
// ============================================================================

export const GetDOMSnapshotInputSchema = z.object({
  sessionId: z.string().optional().describe('Query an existing session by ID'),
  url: z.string().url().optional().describe('Public URL to observe (one-shot mode)'),
  waitMs: z
    .number()
    .int()
    .min(0)
    .max(30000)
    .default(5000)
    .describe('Extra wait time for SPA rendering (one-shot mode only)'),
  selector: z.string().optional().describe('CSS selector to scope the snapshot'),
  maxTokens: z
    .number()
    .int()
    .min(200)
    .max(10000)
    .default(2000)
    .describe('Output token budget'),
});

export type GetDOMSnapshotInput = z.infer<typeof GetDOMSnapshotInputSchema>;

export interface DOMSnapshotNode {
  tag: string;
  text?: string;
  href?: string;
  accessibleName?: string;
  role?: string;
  type?: string;
  name?: string;
  placeholder?: string;
  depth: number;
  childrenCount: number;
}

export interface GetDOMSnapshotOutput {
  url: string;
  observedFor: number;
  selector?: string;
  matchCount: number;
  snapshot: DOMSnapshotNode[] | null;
  truncated: boolean;
  notes?: string[];
}

export type GetDOMSnapshotError = GetConsoleErrorsError;

// ============================================================================
// getPerfMetrics
// ============================================================================

export const GetPerfMetricsInputSchema = z.object({
  sessionId: z.string().optional().describe('Query an existing session by ID'),
  url: z.string().url().optional().describe('Public URL to observe (one-shot mode)'),
  waitMs: z
    .number()
    .int()
    .min(1000)
    .max(30000)
    .default(8000)
    .describe('Extra wait time for CWV to stabilize (one-shot mode only)'),
  maxTokens: z
    .number()
    .int()
    .min(200)
    .max(10000)
    .default(2000)
    .describe('Output token budget'),
});

export type GetPerfMetricsInput = z.infer<typeof GetPerfMetricsInputSchema>;

export type Rating = 'good' | 'needs-improvement' | 'poor';

export interface MetricResult {
  value: number;
  rating: Rating;
}

export interface InpOrTbtResult {
  value: number;
  rating: Rating;
  metric: 'INP' | 'TBT';
}

export interface ResourceTimings {
  dnsLookupMs: number;
  tcpConnectMs: number;
  tlsNegotiationMs: number;
  ttfbMs: number;
  domContentLoadedMs: number;
  loadCompleteMs: number;
}

export interface GetPerfMetricsOutput {
  url: string;
  observedFor: number;
  lcp: MetricResult | null;
  cls: MetricResult | null;
  inp_or_tbt: InpOrTbtResult | null;
  resourceTimings: ResourceTimings;
  samplingNotes: string[];
  truncated: boolean;
  notes?: string[];
}

export type GetPerfMetricsError = GetConsoleErrorsError;
