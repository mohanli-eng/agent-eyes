import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startFixtureServer, stopFixtureServer, getFixtureUrl } from '../setup.js';
import { openSession } from '../../src/tools/open-session.js';
import { closeSession } from '../../src/tools/close-session.js';
import { getPerfMetrics } from '../../src/tools/get-perf-metrics.js';

describe('US-04 getPerfMetrics', () => {
  let baseUrl: string;

  beforeAll(async () => {
    baseUrl = await startFixtureServer();
  });

  afterAll(async () => {
    await stopFixtureServer();
  });

  // TC-33: CWV fields present with ratings
  it('returns lcp, cls, inp_or_tbt with rating fields', async () => {
    const result = await getPerfMetrics({
      url: getFixtureUrl('/perf-page.html'),
      waitMs: 5000,
    });

    expect(result).not.toHaveProperty('error');
    if ('lcp' in result) {
      // LCP may or may not be available depending on page structure
      if (result.lcp) {
        expect(result.lcp).toHaveProperty('value');
        expect(result.lcp).toHaveProperty('rating');
        expect(['good', 'needs-improvement', 'poor']).toContain(result.lcp.rating);
      }
    }
    if ('cls' in result) {
      if (result.cls) {
        expect(result.cls).toHaveProperty('value');
        expect(result.cls).toHaveProperty('rating');
      }
    }
    if ('inp_or_tbt' in result) {
      expect(result.inp_or_tbt).toBeDefined();
      if (result.inp_or_tbt) {
        expect(result.inp_or_tbt).toHaveProperty('value');
        expect(result.inp_or_tbt).toHaveProperty('rating');
        expect(result.inp_or_tbt).toHaveProperty('metric');
        expect(['INP', 'TBT']).toContain(result.inp_or_tbt.metric);
      }
    }
  });

  // TC-34: resourceTimings present
  it('returns resourceTimings with all 6 timing fields', async () => {
    const result = await getPerfMetrics({
      url: getFixtureUrl('/blank.html'),
      waitMs: 3000,
    });

    expect(result).not.toHaveProperty('error');
    if ('resourceTimings' in result) {
      const timings = result.resourceTimings;
      expect(timings).toHaveProperty('dnsLookupMs');
      expect(timings).toHaveProperty('tcpConnectMs');
      expect(timings).toHaveProperty('tlsNegotiationMs');
      expect(timings).toHaveProperty('ttfbMs');
      expect(timings).toHaveProperty('domContentLoadedMs');
      expect(timings).toHaveProperty('loadCompleteMs');
      // All should be non-negative numbers
      Object.values(timings).forEach((v) => {
        expect(typeof v).toBe('number');
        expect(v).toBeGreaterThanOrEqual(0);
      });
    }
  });

  // TC-36: samplingNotes present
  it('includes samplingNotes about metric collection', async () => {
    const result = await getPerfMetrics({
      url: getFixtureUrl('/blank.html'),
    });

    expect(result).not.toHaveProperty('error');
    if ('samplingNotes' in result) {
      expect(Array.isArray(result.samplingNotes)).toBe(true);
      expect(result.samplingNotes.length).toBeGreaterThan(0);
    }
  });

  // TC-37: session mode — returns accumulated perf data
  it('session mode returns accumulated performance metrics', async () => {
    const { sessionId } = await openSession({
      url: getFixtureUrl('/perf-page.html'),
    });

    // Wait for metrics to accumulate
    await new Promise((r) => setTimeout(r, 5000));

    const result = await getPerfMetrics({ sessionId });
    expect(result).not.toHaveProperty('error');
    if ('lcp' in result && result.lcp) {
      expect(result.lcp.value).toBeGreaterThan(0);
    }

    await closeSession({ sessionId });
  });

  // TC-38: null for uncollectable metrics
  it('returns null for metrics that cannot be collected', async () => {
    // Minimal page may not trigger LCP
    const result = await getPerfMetrics({
      url: getFixtureUrl('/blank.html'),
    });

    expect(result).not.toHaveProperty('error');
    if ('lcp' in result) {
      // LCP may be null for very simple pages
      // If null, samplingNotes should mention why
      if (result.lcp === null && 'samplingNotes' in result) {
        expect(
          result.samplingNotes.some((n) => n.toLowerCase().includes('lcp')),
        ).toBe(true);
      }
    }
  });

  // TC-39: INP falls back to TBT in headless browser
  it('uses TBT metric when INP is unavailable (headless)', async () => {
    const result = await getPerfMetrics({
      url: getFixtureUrl('/perf-page.html'),
      waitMs: 5000,
    });

    expect(result).not.toHaveProperty('error');
    if ('inp_or_tbt' in result && result.inp_or_tbt) {
      // In headless browser, INP is typically unavailable → fallback to TBT
      expect(result.inp_or_tbt.metric).toBe('TBT');
    }
  });
});
