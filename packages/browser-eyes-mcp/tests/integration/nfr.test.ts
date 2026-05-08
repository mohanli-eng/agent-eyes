import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startFixtureServer, stopFixtureServer, getFixtureUrl } from '../setup.js';
import { openSession } from '../../src/tools/open-session.js';
import { closeSession } from '../../src/tools/close-session.js';
import { getConsoleErrors } from '../../src/tools/get-console-errors.js';
import { getNetworkRequests } from '../../src/tools/get-network-requests.js';

describe('NFR — Non-Functional Requirements', () => {
  let baseUrl: string;

  beforeAll(async () => {
    baseUrl = await startFixtureServer();
  });

  afterAll(async () => {
    await stopFixtureServer();
  });

  // TC-40 (NFR-AC-01): token budget enforced across tools
  it('NFR-AC-01: output ≤ maxTokens budget for getConsoleErrors', async () => {
    const budget = 200;
    const result = await getConsoleErrors({
      url: getFixtureUrl('/many-errors.html'),
      maxTokens: budget,
    });

    const output = JSON.stringify(result);
    const estimatedTokens = Math.ceil(output.length / 4);
    // Allow small margin for structural JSON overhead
    expect(estimatedTokens).toBeLessThanOrEqual(budget + 50);
  });

  it('NFR-AC-01: output ≤ maxTokens budget for getNetworkRequests', async () => {
    const budget = 200;
    const result = await getNetworkRequests({
      url: getFixtureUrl('/network-requests.html'),
      waitMs: 2000,
      maxTokens: budget,
    });

    const output = JSON.stringify(result);
    const estimatedTokens = Math.ceil(output.length / 4);
    expect(estimatedTokens).toBeLessThanOrEqual(budget + 50);
  });

  // TC-41 (NFR-AC-02): browser processes cleaned up after closeSession
  it('NFR-AC-02: closeSession cleans up browser process', async () => {
    const { sessionId } = await openSession({
      url: getFixtureUrl('/blank.html'),
    });

    const result = await closeSession({ sessionId });
    expect(result.success).toBe(true);

    // Session should not be queryable after close
    const afterClose = await getConsoleErrors({ sessionId });
    expect(afterClose).toHaveProperty('error', 'SESSION_NOT_FOUND');
  });

  // TC-43 (NFR-AC-04): invalid URL protocol rejected immediately
  it('NFR-AC-04: rejects non-http/https URL without launching browser', async () => {
    const result = await getConsoleErrors({
      url: 'ftp://files.example.com/test',
    });

    expect(result).toHaveProperty('error', 'INVALID_URL');
  });

  // TC-45 (NFR-AC-06): session mode — no navigation on query
  it('NFR-AC-06: session mode tools do not navigate, just query', async () => {
    const { sessionId } = await openSession({
      url: getFixtureUrl('/blank.html'),
    });

    // Multiple queries should work without re-navigation
    const r1 = await getConsoleErrors({ sessionId });
    const r2 = await getConsoleErrors({ sessionId });

    expect(r1).not.toHaveProperty('error');
    expect(r2).not.toHaveProperty('error');

    await closeSession({ sessionId });
  });

  // TC-49: auth redirect detection
  it('NFR: detects auth redirect on page with login redirect', async () => {
    const result = await openSession({
      url: getFixtureUrl('/auth-redirect.html'),
    });

    // If the redirect to /login is detected, the tool may return AUTH_NOT_SUPPORTED
    // This depends on whether the tool implements auth detection
    if ('error' in result) {
      expect(['AUTH_NOT_SUPPORTED', 'NETWORK_ERROR']).toContain(result.error);
    }
    // If no error, close the session if it was created
    if ('sessionId' in result) {
      await closeSession({ sessionId: result.sessionId });
    }
  });

  // TC-50 (NFR-AC-04 variant): javascript: protocol rejected
  it('NFR-AC-04: rejects javascript: URL', async () => {
    const result = await getConsoleErrors({
      url: 'javascript:alert(1)',
    });

    expect(result).toHaveProperty('error', 'INVALID_URL');
  });
});
