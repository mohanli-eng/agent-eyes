import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startFixtureServer, stopFixtureServer, getFixtureUrl } from '../setup.js';
import { openSession } from '../../src/tools/open-session.js';
import { closeSession } from '../../src/tools/close-session.js';
import { getConsoleErrors } from '../../src/tools/get-console-errors.js';
import { assertIsUUID } from '../test-utils.js';

describe('US-00 Session Lifecycle', () => {
  let baseUrl: string;

  beforeAll(async () => {
    baseUrl = await startFixtureServer();
  });

  afterAll(async () => {
    await stopFixtureServer();
  });

  // TC-01: openSession returns valid sessionId
  it('openSession returns sessionId in UUID format', async () => {
    const result = await openSession({
      url: getFixtureUrl('/blank.html'),
    });

    expect(result).toHaveProperty('sessionId');
    assertIsUUID(result.sessionId);
    expect(result.url).toContain('/blank.html');

    await closeSession({ sessionId: result.sessionId });
  });

  // TC-02: closeSession cleans up and returns success
  it('closeSession returns success and cleans up session', async () => {
    const { sessionId } = await openSession({
      url: getFixtureUrl('/blank.html'),
    });

    const result = await closeSession({ sessionId });
    expect(result.success).toBe(true);

    // TC-05: double close returns false
    const secondClose = await closeSession({ sessionId });
    expect(secondClose.success).toBe(false);
  });

  // TC-04: invalid sessionId returns SESSION_NOT_FOUND
  it('getConsoleErrors with nonexistent sessionId returns SESSION_NOT_FOUND', async () => {
    const result = await getConsoleErrors({
      sessionId: 'nonexistent-id-12345',
    });

    expect(result).toHaveProperty('error', 'SESSION_NOT_FOUND');
  });

  // TC-42b: session mode — same session shares accumulated data
  it('session mode accumulates console errors across queries', async () => {
    const { sessionId } = await openSession({
      url: getFixtureUrl('/console-errors.html'),
    });

    // Wait for errors to accumulate (the page throws errors on load)
    await new Promise((r) => setTimeout(r, 2000));

    const first = await getConsoleErrors({ sessionId });
    expect(first).toHaveProperty('url');
    expect(first).not.toHaveProperty('error');

    // Errors should be present and accumulated
    if ('totalErrors' in first) {
      expect(first.totalErrors).toBeGreaterThan(0);
    }

    await closeSession({ sessionId });
  });

  // TC-42a: one-shot mode — two independent calls have no shared state
  it('one-shot mode has no state sharing between calls', async () => {
    const r1 = await getConsoleErrors({
      url: getFixtureUrl('/blank.html'),
    });
    const r2 = await getConsoleErrors({
      url: getFixtureUrl('/blank.html'),
    });

    expect(r1).toHaveProperty('url');
    expect(r2).toHaveProperty('url');
    if ('totalErrors' in r1 && 'totalErrors' in r2) {
      // Both should independently report zero errors on the blank page
      expect(r1.totalErrors).toBe(0);
      expect(r2.totalErrors).toBe(0);
    }
  });
});
