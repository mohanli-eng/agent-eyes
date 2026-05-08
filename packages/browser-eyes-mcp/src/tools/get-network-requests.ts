/**
 * getNetworkRequests tool — network request observation with session & one-shot modes.
 */

import { ConsoleMessage, Request as PwRequest, Response as PwResponse } from 'playwright';
import { createSession } from '../browser/session-manager.js';
import type { NetworkEntry, CapturedMessage } from '../browser/session-manager.js';
import { truncateToTokenBudget, truncateString } from '../browser/truncation.js';
import { resolveMode } from '../shared/resolve-mode.js';
import { canonicalizeUrl } from '../shared/url-pattern.js';
import { GetNetworkRequestsInputSchema } from '../types.js';
import type {
  GetNetworkRequestsInput,
  GetNetworkRequestsOutput,
  GetNetworkRequestsError,
  FailedRequest,
  SlowRequest,
  RedirectEntry,
  GroupedByPattern,
} from '../types.js';

export async function getNetworkRequests(
  raw: GetNetworkRequestsInput,
): Promise<GetNetworkRequestsOutput | GetNetworkRequestsError> {
  const input = GetNetworkRequestsInputSchema.parse(raw);
  const { waitMs, slowThresholdMs, maxTokens } = input;

  const resolved = resolveMode(input.sessionId, input.url);
  if ('error' in resolved) {
    return { error: resolved.error as GetNetworkRequestsError['error'], message: resolved.message };
  }

  // ── Session mode ──────────────────────────────────────────────────
  if (resolved.mode === 'session') {
    const session = resolved.session!;
    return buildOutput(
      resolved.url,
      Date.now() - session.createdAt,
      session.networkEntries,
      slowThresholdMs,
      maxTokens,
    );
  }

  // ── One-shot mode ─────────────────────────────────────────────────
  const url = resolved.url;
  const networkEntries: NetworkEntry[] = [];
  const pendingRequests = new Map<PwRequest, number>();
  const startTime = Date.now();
  let session;

  try {
    session = await createSession();

    session.page.on('request', (req: PwRequest) => {
      if (req.url().startsWith('data:') || req.url().startsWith('blob:')) return;
      pendingRequests.set(req, Date.now());
    });

    session.page.on('response', (res: PwResponse) => {
      const req = res.request();
      if (req.url().startsWith('data:') || req.url().startsWith('blob:')) return;

      const startTimeReq = pendingRequests.get(req);
      pendingRequests.delete(req);

      networkEntries.push({
        url: res.url(),
        method: req.method(),
        status: res.status(),
        statusText: res.statusText(),
        resourceType: req.resourceType(),
        startTimeMs: startTimeReq ? startTimeReq - startTime : 0,
        durationMs: startTimeReq ? Date.now() - startTimeReq : 0,
        redirectChain: [],
      });
    });

    session.page.on('requestfailed', (req: PwRequest) => {
      if (req.url().startsWith('data:') || req.url().startsWith('blob:')) return;
      const startTimeReq = pendingRequests.get(req);
      pendingRequests.delete(req);

      networkEntries.push({
        url: req.url(),
        method: req.method(),
        status: 0,
        statusText: req.failure()?.errorText || 'Unknown',
        resourceType: req.resourceType(),
        startTimeMs: startTimeReq ? startTimeReq - startTime : 0,
        durationMs: startTimeReq ? Date.now() - startTimeReq : 0,
        redirectChain: [],
      });
    });

    try {
      await session.page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes('timeout')) {
        return { error: 'TIMEOUT', message };
      }
      return { error: 'NETWORK_ERROR', message };
    }

    await session.page.waitForTimeout(waitMs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: 'CRASH', message };
  } finally {
    if (session) {
      await session.close().catch(() => {});
    }
  }

  const observedFor = Date.now() - startTime;
  return buildOutput(url, observedFor, networkEntries, slowThresholdMs, maxTokens);
}

// ── Output builder ──────────────────────────────────────────────────

function buildOutput(
  url: string,
  observedFor: number,
  entries: NetworkEntry[],
  slowThresholdMs: number,
  maxTokens: number,
): GetNetworkRequestsOutput {
  // Identify streaming entries
  const streamingTypes = new Set(['websocket', 'eventsource']);

  const failed: FailedRequest[] = [];
  const slow: SlowRequest[] = [];
  const redirects: RedirectEntry[] = [];

  for (const e of entries) {
    const isStreaming = streamingTypes.has(e.resourceType);

    // Failed: 4xx/5xx, excluding streaming
    if (!isStreaming && e.status >= 400) {
      failed.push({
        url: e.url,
        method: e.method,
        status: e.status,
        statusText: e.statusText,
        durationMs: e.durationMs,
        type: e.resourceType,
      });
    }

    // Slow: exceeds threshold, excluding streaming
    if (!isStreaming && e.durationMs >= slowThresholdMs && e.status < 400) {
      slow.push({
        url: e.url,
        method: e.method,
        status: e.status,
        durationMs: e.durationMs,
        type: e.resourceType,
      });
    }

    // Redirect chains from the page goto itself
    if (
      e.status >= 300 &&
      e.status < 400 &&
      e.redirectChain.length === 0
    ) {
      // Playwright handles redirects transparently, so direct 3xx are rare here.
      // Record them if seen.
    }
  }

  // URL pattern grouping
  const patternMap = new Map<string, { totalDurationMs: number; errorCount: number; count: number }>();
  for (const e of entries) {
    const pattern = canonicalizeUrl(e.url);
    const existing = patternMap.get(pattern) || { totalDurationMs: 0, errorCount: 0, count: 0 };
    existing.totalDurationMs += e.durationMs;
    if (e.status >= 400) existing.errorCount++;
    existing.count++;
    patternMap.set(pattern, existing);
  }

  const groupedByPattern: GroupedByPattern[] = [...patternMap.entries()]
    .map(([pattern, stats]) => ({
      pattern,
      count: stats.count,
      avgDurationMs: Math.round(stats.totalDurationMs / stats.count),
      errorRate: stats.count > 0 ? Math.round((stats.errorCount / stats.count) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Token truncation: failedRequests first, then slowRequests, then groupedByPattern
  let usedTokens = 0;
  const keptFailed: FailedRequest[] = [];
  const keptSlow: SlowRequest[] = [];
  const keptGrouped: GroupedByPattern[] = [];
  let truncated = false;

  const estimateTokens = (s: string) => Math.ceil(s.length / 4);

  for (const item of failed) {
    const itemTokens = estimateTokens(JSON.stringify(item));
    if (usedTokens + itemTokens > maxTokens) { truncated = true; break; }
    keptFailed.push(item);
    usedTokens += itemTokens;
  }

  if (!truncated) {
    for (const item of slow) {
      const itemTokens = estimateTokens(JSON.stringify(item));
      if (usedTokens + itemTokens > maxTokens) { truncated = true; break; }
      keptSlow.push(item);
      usedTokens += itemTokens;
    }
  }

  if (!truncated) {
    for (const item of groupedByPattern) {
      const itemTokens = estimateTokens(JSON.stringify(item));
      if (usedTokens + itemTokens > maxTokens) { truncated = true; break; }
      keptGrouped.push(item);
      usedTokens += itemTokens;
    }
  }

  const notes: string[] = [];
  if (truncated) {
    const omitted = (failed.length + slow.length + groupedByPattern.length) -
      (keptFailed.length + keptSlow.length + keptGrouped.length);
    notes.push(`${omitted} additional entries omitted to fit token budget`);
  }

  return {
    url,
    observedFor,
    totalRequests: entries.length,
    failedRequests: keptFailed,
    slowRequests: keptSlow,
    redirects,
    groupedByPattern: keptGrouped,
    truncated,
    notes: notes.length ? notes : undefined,
  };
}
