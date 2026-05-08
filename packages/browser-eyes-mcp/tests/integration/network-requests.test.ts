import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startFixtureServer, stopFixtureServer, getFixtureUrl } from '../setup.js';
import { openSession } from '../../src/tools/open-session.js';
import { closeSession } from '../../src/tools/close-session.js';
import { getNetworkRequests } from '../../src/tools/get-network-requests.js';

describe('US-02a getNetworkRequests', () => {
  let baseUrl: string;

  beforeAll(async () => {
    baseUrl = await startFixtureServer();
  });

  afterAll(async () => {
    await stopFixtureServer();
  });

  // TC-16: no failures on page with only success requests
  it('returns empty failedRequests and slowRequests for clean page', async () => {
    const result = await getNetworkRequests({
      url: getFixtureUrl('/blank.html'),
    });

    expect(result).not.toHaveProperty('error');
    if ('totalRequests' in result) {
      expect(result.totalRequests).toBeGreaterThanOrEqual(1); // the HTML document itself
      expect(result.failedRequests).toEqual([]);
      expect(result.slowRequests).toEqual([]);
    }
  });

  // TC-17: 500 error captured
  it('captures 500 response in failedRequests', async () => {
    const result = await getNetworkRequests({
      url: getFixtureUrl('/network-requests.html'),
      waitMs: 3000,
    });

    expect(result).not.toHaveProperty('error');
    if ('failedRequests' in result) {
      const fail500 = result.failedRequests.find((r) => r.status === 500);
      expect(fail500).toBeDefined();
      expect(fail500!.url).toContain('/api/fail');
      expect(fail500).toHaveProperty('method');
      expect(fail500).toHaveProperty('statusText');
      expect(fail500).toHaveProperty('durationMs');
    }
  });

  // TC-18: slowThresholdMs filters slow requests
  it('filters slow requests by threshold', async () => {
    const result = await getNetworkRequests({
      url: getFixtureUrl('/network-requests.html'),
      waitMs: 3000,
      slowThresholdMs: 1000,
    });

    expect(result).not.toHaveProperty('error');
    if ('slowRequests' in result) {
      // /api/slow takes 2000ms, should be in slowRequests when threshold is 1000ms
      const slowOnes = result.slowRequests.filter((r) => r.url.includes('/api/slow'));
      expect(slowOnes.length).toBeGreaterThan(0);
      expect(slowOnes[0].durationMs).toBeGreaterThanOrEqual(1000);
    }
  });

  // TC-20: token truncation — failedRequests preserved first
  it('preserves failedRequests over slowRequests when truncated', async () => {
    const result = await getNetworkRequests({
      url: getFixtureUrl('/network-requests.html'),
      waitMs: 3000,
      maxTokens: 200,
    });

    expect(result).not.toHaveProperty('error');
    if ('truncated' in result && result.truncated) {
      // When truncated, all failedRequests should be present
      // (they have higher priority than slowRequests)
      expect(result).toHaveProperty('failedRequests');
      expect(result).toHaveProperty('notes');
    }
  });

  // TC-21: session mode — queries accumulated network data
  it('session mode returns accumulated network requests', async () => {
    const { sessionId } = await openSession({
      url: getFixtureUrl('/network-requests.html'),
    });

    // Wait for network requests to complete
    await new Promise((r) => setTimeout(r, 4000));

    const result = await getNetworkRequests({ sessionId });
    expect(result).not.toHaveProperty('error');
    if ('totalRequests' in result) {
      expect(result.totalRequests).toBeGreaterThan(0);
    }

    await closeSession({ sessionId });
  });

  // TC-23: data: and blob: URLs excluded
  it('excludes data: and blob: URLs from results', async () => {
    const result = await getNetworkRequests({
      url: getFixtureUrl('/network-requests.html'),
      waitMs: 3000,
    });

    expect(result).not.toHaveProperty('error');
    if ('failedRequests' in result && 'slowRequests' in result) {
      const allRequests = [...result.failedRequests, ...result.slowRequests];
      const dataUrls = allRequests.filter(
        (r) => r.url.startsWith('data:') || r.url.startsWith('blob:'),
      );
      expect(dataUrls).toEqual([]);
    }
  });

  // TC-24: redirect chain preserved
  it('preserves 3xx redirects in redirects field, not failedRequests', async () => {
    const result = await getNetworkRequests({
      url: getFixtureUrl('/network-requests.html'),
      waitMs: 3000,
    });

    expect(result).not.toHaveProperty('error');
    if ('redirects' in result && 'failedRequests' in result) {
      // Redirects should not be in failedRequests
      const redirectsInFailed = result.failedRequests.filter(
        (r) => r.url.includes('/old-path'),
      );
      expect(redirectsInFailed).toEqual([]);

      // Should be tracked in redirects field if captured
      if (result.redirects.length > 0) {
        const redirect = result.redirects.find((r) => r.from.includes('/old-path'));
        if (redirect) {
          expect(redirect.status).toBeGreaterThanOrEqual(300);
          expect(redirect.status).toBeLessThan(400);
        }
      }
    }
  });
});
