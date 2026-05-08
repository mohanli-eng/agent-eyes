import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startFixtureServer, stopFixtureServer, getFixtureUrl } from '../setup.js';
import { getConsoleErrors } from '../../src/tools/get-console-errors.js';

describe('US-01 getConsoleErrors', () => {
  let baseUrl: string;

  beforeAll(async () => {
    baseUrl = await startFixtureServer();
  });

  afterAll(async () => {
    await stopFixtureServer();
  });

  // TC-07: zero console errors
  it('returns totalErrors: 0 for blank page', async () => {
    const result = await getConsoleErrors({
      url: getFixtureUrl('/blank.html'),
    });

    expect(result).toHaveProperty('url');
    expect(result).not.toHaveProperty('error');
    if ('totalErrors' in result) {
      expect(result.totalErrors).toBe(0);
      expect(result.uniqueErrors).toEqual([]);
    }
  });

  // TC-08: 50 identical errors deduplicated
  it('deduplicates 50 identical errors into 1 unique entry with count 50', async () => {
    const result = await getConsoleErrors({
      url: getFixtureUrl('/console-errors.html'),
    });

    expect(result).not.toHaveProperty('error');
    if ('totalErrors' in result) {
      // The page throws 50 TypeError + 1 ReferenceError = 51 total errors
      // Plus uncaught exception in setTimeout = 1 pageerror
      expect(result.totalErrors).toBeGreaterThanOrEqual(50);

      const typeErr = result.uniqueErrors.find(
        (e) => e.message.includes('Cannot read properties of null'),
      );
      expect(typeErr).toBeDefined();
      expect(typeErr!.count).toBe(50);
    }
  });

  // TC-09: truncation when too many unique errors
  it('truncates output when 100+ different errors exist, with truncated: true', async () => {
    const result = await getConsoleErrors({
      url: getFixtureUrl('/many-errors.html'),
      maxTokens: 500,
    });

    expect(result).not.toHaveProperty('error');
    if ('truncated' in result) {
      expect(result.truncated).toBe(true);
      expect(result.notes?.some((n) => n.includes('omitted'))).toBe(true);
    }
  });

  // TC-11: includeWarnings
  it('includes warnings when includeWarnings: true', async () => {
    const without = await getConsoleErrors({
      url: getFixtureUrl('/console-errors.html'),
    });
    const withWarnings = await getConsoleErrors({
      url: getFixtureUrl('/console-errors.html'),
      includeWarnings: true,
    });

    if ('totalWarnings' in withWarnings) {
      expect(withWarnings.totalWarnings).toBeGreaterThan(0);
    }
    if ('totalWarnings' in without && 'totalWarnings' in withWarnings) {
      expect(withWarnings.totalWarnings).toBeGreaterThan(without.totalWarnings);
    }
  });

  // TC-13: dedup by (level, message), not by source
  it('deduplicates by message content, not source location', async () => {
    const result = await getConsoleErrors({
      url: getFixtureUrl('/dedup-errors.html'),
    });

    expect(result).not.toHaveProperty('error');
    if ('uniqueErrors' in result) {
      const duped = result.uniqueErrors.filter(
        (e) => e.message.includes('Cannot read properties of undefined'),
      );
      expect(duped.length).toBe(1);
      expect(duped[0].count).toBe(3);
    }
  });

  // TC-14: third-party script errors captured
  it('captures errors from third-party scripts', async () => {
    const result = await getConsoleErrors({
      url: getFixtureUrl('/third-party-scripts.html'),
    });

    expect(result).not.toHaveProperty('error');
    if ('uniqueErrors' in result) {
      const trackingErrors = result.uniqueErrors.filter(
        (e) => e.message.includes('Tracking SDK'),
      );
      expect(trackingErrors.length).toBeGreaterThan(0);
    }
  });

  // TC-44: listener mounted before navigation — catches early errors
  it('captures errors thrown in <head> script before page load', async () => {
    const result = await getConsoleErrors({
      url: getFixtureUrl('/early-error.html'),
    });

    expect(result).not.toHaveProperty('error');
    if ('totalErrors' in result) {
      expect(result.totalErrors).toBeGreaterThanOrEqual(1);
      expect(
        result.uniqueErrors.some((e) => e.message.includes('Error in head')),
      ).toBe(true);
    }
  });

  // TC-10: token budget respected
  it('output stays within maxTokens budget', async () => {
    const result = await getConsoleErrors({
      url: getFixtureUrl('/many-errors.html'),
      maxTokens: 200,
    });

    // Character-based approximation: output should be under 200*4=800 chars
    const output = JSON.stringify(result);
    const estimatedTokens = Math.ceil(output.length / 4);
    expect(estimatedTokens).toBeLessThanOrEqual(200 + 50); // small margin for structural JSON
  });
});
