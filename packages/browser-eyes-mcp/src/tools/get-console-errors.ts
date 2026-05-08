/**
 * getConsoleErrors tool — console error observation with session & one-shot modes.
 */

import { ConsoleMessage } from 'playwright';
import { createSession } from '../browser/session-manager.js';
import { truncateToTokenBudget, truncateString } from '../browser/truncation.js';
import { resolveMode } from '../shared/resolve-mode.js';
import { GetConsoleErrorsInputSchema } from '../types.js';
import type {
  GetConsoleErrorsInput,
  GetConsoleErrorsOutput,
  GetConsoleErrorsError,
  UniqueError,
} from '../types.js';
import type { CapturedMessage } from '../browser/session-manager.js';

/**
 * Main handler for the getConsoleErrors tool.
 */
export async function getConsoleErrors(
  raw: GetConsoleErrorsInput,
): Promise<GetConsoleErrorsOutput | GetConsoleErrorsError> {
  const input = GetConsoleErrorsInputSchema.parse(raw);
  const { waitMs, includeWarnings, maxTokens } = input;

  const resolved = resolveMode(input.sessionId, input.url);
  if ('error' in resolved) {
    return { error: resolved.error as GetConsoleErrorsError['error'], message: resolved.message };
  }

  // ── Session mode: query accumulated data ──────────────────────────
  if (resolved.mode === 'session') {
    const session = resolved.session!;
    const allMessages = [...session.consoleMessages, ...session.pageErrors];
    return buildOutput(
      resolved.url,
      Date.now() - session.createdAt,
      allMessages,
      includeWarnings,
      maxTokens,
    );
  }

  // ── One-shot mode: create browser, observe, close ─────────────────
  const url = resolved.url;
  const captured: CapturedMessage[] = [];
  const startTime = Date.now();
  let session;

  try {
    session = await createSession();

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

    session.page.on('pageerror', (err: Error) => {
      captured.push({
        level: 'error',
        message: truncateString(`Uncaught ${err.name}: ${err.message}`, 500),
        source: undefined,
        timestampMs: Date.now() - startTime,
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
  return buildOutput(url, observedFor, captured, includeWarnings, maxTokens);
}

// ── Shared output builder ─────────────────────────────────────────────

function buildOutput(
  url: string,
  observedFor: number,
  captured: CapturedMessage[],
  includeWarnings: boolean,
  maxTokens: number,
): GetConsoleErrorsOutput {
  const filtered = includeWarnings
    ? captured
    : captured.filter((m) => m.level === 'error');

  const uniqueMap = new Map<string, UniqueError>();
  for (const msg of filtered) {
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
  const { kept, truncated, omittedCount } = truncateToTokenBudget(allUnique, maxTokens);

  const totalErrors = filtered.filter((m) => m.level === 'error').length;
  const totalWarnings = filtered.filter((m) => m.level === 'warning').length;

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
