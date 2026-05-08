/**
 * getPerfMetrics tool — Core Web Vitals + resource timings, session & one-shot modes.
 */

import { createSession } from '../browser/session-manager.js';
import { resolveMode } from '../shared/resolve-mode.js';
import { GetPerfMetricsInputSchema } from '../types.js';
import type {
  GetPerfMetricsInput,
  GetPerfMetricsOutput,
  GetPerfMetricsError,
  Rating,
} from '../types.js';

// ── Rating helpers ──────────────────────────────────────────────────

export function rateLCP(value: number): Rating {
  if (value <= 2500) return 'good';
  if (value <= 4000) return 'needs-improvement';
  return 'poor';
}

export function rateCLS(value: number): Rating {
  if (value <= 0.1) return 'good';
  if (value <= 0.25) return 'needs-improvement';
  return 'poor';
}

export function rateINP(value: number): Rating {
  if (value <= 200) return 'good';
  if (value <= 500) return 'needs-improvement';
  return 'poor';
}

export function rateTBT(value: number): Rating {
  if (value <= 200) return 'good';
  if (value <= 600) return 'needs-improvement';
  return 'poor';
}

// ── Main handler ────────────────────────────────────────────────────

export async function getPerfMetrics(
  raw: GetPerfMetricsInput,
): Promise<GetPerfMetricsOutput | GetPerfMetricsError> {
  const input = GetPerfMetricsInputSchema.parse(raw);
  const { waitMs } = input;

  const resolved = resolveMode(input.sessionId, input.url);
  if ('error' in resolved) {
    return { error: resolved.error as GetPerfMetricsError['error'], message: resolved.message };
  }

  const startTime = Date.now();
  let page;
  let cleanup: (() => Promise<void>) | null = null;

  // ── Session mode ──────────────────────────────────────────────────
  if (resolved.mode === 'session') {
    page = resolved.session!.browserSession.page;
  } else {
    // ── One-shot mode ───────────────────────────────────────────────
    const url = resolved.url;
    const session = await createSession();
    cleanup = async () => { await session.close().catch(() => {}); };
    try {
      await session.page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await cleanup();
      if (message.toLowerCase().includes('timeout')) {
        return { error: 'TIMEOUT', message };
      }
      return { error: 'NETWORK_ERROR', message };
    }

    // Wait for metrics to accumulate before querying
    await session.page.waitForTimeout(waitMs);
    page = session.page;
  }

  // ── Collect metrics ───────────────────────────────────────────────
  try {
    const metrics = await page.evaluate(() => {
      const samplingNotes: string[] = [];
      let lcpValue: number | null = null;
      let clsValue = 0;
      let tbtValue = 0;
      let inpValue: number | null = null;

      // LCP from buffered entries
      try {
        const lcpEntries = performance.getEntriesByType(
          'largest-contentful-paint',
        ) as PerformanceEntry[];
        if (lcpEntries.length > 0) {
          lcpValue = lcpEntries[lcpEntries.length - 1].startTime;
        } else {
          samplingNotes.push('LCP not available: no largest-contentful-paint entry found');
        }
      } catch {
        samplingNotes.push('LCP not available: PerformanceObserver error');
      }

      // CLS from buffered layout-shift entries
      try {
        const lsEntries = performance.getEntriesByType(
          'layout-shift',
        ) as (PerformanceEntry & { value?: number; hadRecentInput?: boolean })[];
        for (const entry of lsEntries) {
          if (entry.value !== undefined && !entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
      } catch {
        samplingNotes.push('CLS may be incomplete: layout-shift entries unavailable');
      }

      // TBT from buffered longtask entries
      try {
        const ltEntries = performance.getEntriesByType(
          'longtask',
        ) as (PerformanceEntry & { duration?: number })[];
        for (const entry of ltEntries) {
          if (entry.duration !== undefined) {
            tbtValue += Math.max(0, entry.duration - 50);
          }
        }
      } catch {
        samplingNotes.push('TBT may be incomplete: longtask entries unavailable');
      }

      // Navigation timing
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      const nav = navEntries[0];
      const resourceTimings = nav
        ? {
            dnsLookupMs: nav.domainLookupEnd - nav.domainLookupStart,
            tcpConnectMs: nav.connectEnd - nav.connectStart,
            tlsNegotiationMs:
              nav.secureConnectionStart > 0
                ? nav.connectEnd - nav.secureConnectionStart
                : 0,
            ttfbMs: nav.responseStart - nav.requestStart,
            domContentLoadedMs:
              nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
            loadCompleteMs: nav.loadEventEnd - nav.loadEventStart,
          }
        : {
            dnsLookupMs: 0,
            tcpConnectMs: 0,
            tlsNegotiationMs: 0,
            ttfbMs: 0,
            domContentLoadedMs: 0,
            loadCompleteMs: 0,
          };

      // INP not available in headless without interaction
      samplingNotes.push(
        'INP requires user interaction; use TBT (Total Blocking Time) as a proxy metric in headless mode',
      );

      return {
        lcpValue,
        clsValue,
        tbtValue,
        inpValue,
        resourceTimings,
        samplingNotes,
      };
    });

    const samplingNotes = metrics.samplingNotes;
    const lcp =
      metrics.lcpValue !== null
        ? { value: metrics.lcpValue, rating: rateLCP(metrics.lcpValue) }
        : null;
    const cls =
      clsValuePresent(metrics.clsValue)
        ? { value: metrics.clsValue, rating: rateCLS(metrics.clsValue) }
        : null;

    // Use TBT as default (INP unavailable in headless)
    const inp_or_tbt = {
      value: Math.round(metrics.tbtValue),
      rating: rateTBT(metrics.tbtValue),
      metric: 'TBT' as const,
    };

    const observedFor = Date.now() - startTime;

    return {
      url: resolved.url,
      observedFor,
      lcp,
      cls,
      inp_or_tbt,
      resourceTimings: metrics.resourceTimings,
      samplingNotes,
      truncated: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: 'CRASH', message };
  } finally {
    if (cleanup) {
      await cleanup();
    }
  }
}

function clsValuePresent(v: number): boolean {
  return !isNaN(v) && isFinite(v);
}
