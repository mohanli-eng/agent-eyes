/**
 * getConsoleErrors tool implementation.
 *
 * Open a URL in headless Chromium, observe for `waitMs` after load,
 * collect console errors/warnings, deduplicate, truncate to token budget.
 *
 * See SPEC.md section 4.1 for full specification.
 */

import { ConsoleMessage } from 'playwright';
import { createSession } from '../browser/session-manager.js';
import {
  truncateToTokenBudget,
  truncateString,
} from '../browser/truncation.js';
import type {
  GetConsoleErrorsInput,
  GetConsoleErrorsOutput,
  GetConsoleErrorsError,
  UniqueError,
} from '../types.js';

interface CapturedMessage {
  level: 'error' | 'warning';
  message: string;
  source?: string;
  timestampMs: number;
}

/**
 * Main handler for the getConsoleErrors tool.
 */
export async function getConsoleErrors(
  input: GetConsoleErrorsInput,
): Promise<GetConsoleErrorsOutput | GetConsoleErrorsError> {
  const { url, waitMs, includeWarnings, maxTokens } = input;

  // Validate URL
  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    return {
      error: 'INVALID_URL',
      message: 'URL must start with http:// or https://',
    };
  }

  let session;
  const captured: CapturedMessage[] = [];
  const startTime = Date.now();

  try {
    session = await createSession();

    // Attach console listener BEFORE navigation
    session.page.on('console', (msg: ConsoleMessage) => {
      const type = msg.type();
      const wantedTypes = includeWarnings ? ['error', 'warning'] : ['error'];
      if (!wantedTypes.includes(type)) return;

      const location = msg.location();
      const source =
        location.url && location.lineNumber !== undefined
          ? `${shortenSource(location.url)}:${location.lineNumber}`
          : undefined;

      captured.push({
        level: type === 'warning' ? 'warning' : 'error',
        message: truncateString(msg.text(), 500),
        source,
        timestampMs: Date.now() - startTime,
      });
    });

    // Also catch uncaught page errors (these don't always go through console)
    session.page.on('pageerror', (err: Error) => {
      captured.push({
        level: 'error',
        message: truncateString(`Uncaught ${err.name}: ${err.message}`, 500),
        source: undefined,
        timestampMs: Date.now() - startTime,
      });
    });

    // Navigate
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

    // Wait additional time for delayed errors (lazy-loaded scripts, useEffect, etc.)
    await session.page.waitForTimeout(waitMs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: 'CRASH', message };
  } finally {
    if (session) {
      await session.close().catch(() => {
        // Best-effort cleanup
      });
    }
  }

  const observedFor = Date.now() - startTime;

  // Deduplicate
  const uniqueMap = new Map<string, UniqueError>();
  for (const msg of captured) {
    const key = `${msg.level}::${msg.message}`;
    const existing = uniqueMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      uniqueMap.set(key, {
        level: msg.level,
        message: msg.message,
        source: msg.source,
        count: 1,
        firstSeenMs: msg.timestampMs,
      });
    }
  }

  const allUnique = [...uniqueMap.values()].sort((a, b) => b.count - a.count);

  // Truncate to token budget
  const { kept, truncated, omittedCount } = truncateToTokenBudget(
    allUnique,
    maxTokens,
  );

  const totalErrors = captured.filter((m) => m.level === 'error').length;
  const totalWarnings = captured.filter((m) => m.level === 'warning').length;

  const notes: string[] = [];
  if (truncated) {
    notes.push(
      `${omittedCount} additional unique ${
        omittedCount === 1 ? 'message' : 'messages'
      } omitted to fit token budget`,
    );
  }

  return {
    url,
    observedFor,
    totalErrors,
    totalWarnings,
    uniqueErrors: kept,
    truncated,
    notes: notes.length ? notes : undefined,
  };
}

/**
 * Shorten a long URL/file path for display in `source` field.
 * Keeps the last 2 path segments.
 */
function shortenSource(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const tail = parts.slice(-2).join('/');
    return tail || parsed.hostname;
  } catch {
    return url.slice(-60);
  }
}
