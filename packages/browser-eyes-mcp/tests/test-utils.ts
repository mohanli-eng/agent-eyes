import type { BrowserSession } from '../src/browser/session-manager.js';

/**
 * Helper to wait a fixed time and return elapsed.
 */
export async function timedWait(ms: number): Promise<number> {
  const start = Date.now();
  await new Promise((r) => setTimeout(r, ms));
  return Date.now() - start;
}

/**
 * Assert that a string is a valid UUID v4.
 */
export function assertIsUUID(value: string): void {
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(value)) {
    throw new Error(`Expected UUID v4, got: ${value}`);
  }
}

/**
 * Safely close a BrowserSession, ignoring errors.
 */
export async function safeClose(session: BrowserSession): Promise<void> {
  await session.close().catch(() => {});
}

/**
 * Token estimation helper — characters / 4 rounded up.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Build a test URL with optional query params.
 */
export function fixtureUrl(base: string, path: string): string {
  return `${base}${path}`;
}
