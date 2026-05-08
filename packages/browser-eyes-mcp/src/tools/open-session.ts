/**
 * openSession tool — navigates to a URL, mounts all listeners, keeps browser alive.
 */

import { randomUUID } from 'crypto';
import { ConsoleMessage, Request as PwRequest, Response as PwResponse } from 'playwright';
import { createSession } from '../browser/session-manager.js';
import type { SessionData, CapturedMessage, NetworkEntry } from '../browser/session-manager.js';
import { storeSession } from '../browser/session-store.js';
import { truncateString } from '../browser/truncation.js';
import { OpenSessionInputSchema } from '../types.js';
import type { OpenSessionInput, OpenSessionOutput, OpenSessionError } from '../types.js';

export async function openSession(
  raw: OpenSessionInput,
): Promise<OpenSessionOutput | OpenSessionError> {
  const input = OpenSessionInputSchema.parse(raw);
  const { url } = input;

  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    return { error: 'INVALID_URL', message: 'URL must start with http:// or https://' };
  }

  const bs = await createSession();
  const startTime = Date.now();

  const consoleMessages: CapturedMessage[] = [];
  const networkEntries: NetworkEntry[] = [];
  const pageErrors: CapturedMessage[] = [];
  const pendingRequests = new Map<PwRequest, number>();
  const redirectChains = new Map<string, Array<{ url: string; status: number }>>();

  // Mount console listener
  bs.page.on('console', (msg: ConsoleMessage) => {
    const location = msg.location();
    const source =
      location.url && location.lineNumber !== undefined
        ? `${location.url}:${location.lineNumber}`
        : undefined;
    consoleMessages.push({
      level: msg.type() === 'warning' ? 'warning' : 'error',
      message: truncateString(msg.text(), 500),
      source,
      timestampMs: Date.now() - startTime,
    });
  });

  // Mount page error listener
  bs.page.on('pageerror', (err: Error) => {
    pageErrors.push({
      level: 'error',
      message: truncateString(`Uncaught ${err.name}: ${err.message}`, 500),
      source: undefined,
      timestampMs: Date.now() - startTime,
    });
  });

  // Mount network listeners
  bs.page.on('request', (req: PwRequest) => {
    if (req.url().startsWith('data:') || req.url().startsWith('blob:')) return;
    pendingRequests.set(req, Date.now());
  });

  bs.page.on('response', (res: PwResponse) => {
    const req = res.request();
    if (req.url().startsWith('data:') || req.url().startsWith('blob:')) return;

    const startTimeReq = pendingRequests.get(req);
    pendingRequests.delete(req);

    // Track redirect chain
    const chain: Array<{ url: string; status: number }> = [];
    let currentReq = req;
    while (currentReq.redirectedFrom()) {
      const from = currentReq.redirectedFrom()!;
      chain.unshift({ url: from.url(), status: 0 });
      currentReq = from;
    }

    networkEntries.push({
      url: res.url(),
      method: req.method(),
      status: res.status(),
      statusText: res.statusText(),
      resourceType: req.resourceType(),
      startTimeMs: startTimeReq ? startTimeReq - startTime : 0,
      durationMs: startTimeReq ? Date.now() - startTimeReq : 0,
      redirectChain: chain,
    });
  });

  bs.page.on('requestfailed', (req: PwRequest) => {
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

  // Mount PerformanceObservers for CWV
  await bs.page.evaluate(() => {
    try {
      const lcpObs = new PerformanceObserver(() => {});
      lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });

      const clsObs = new PerformanceObserver(() => {});
      clsObs.observe({ type: 'layout-shift', buffered: true });

      const ltObs = new PerformanceObserver(() => {});
      ltObs.observe({ type: 'longtask', buffered: true });

      // Store observers for later disconnect (no-op in session mode — live till close)
      (window as any).__browserEyesObservers = { lcpObs, clsObs, ltObs };
    } catch {
      // best-effort
    }
  }).catch(() => {});

  // Navigate
  try {
    await bs.page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await bs.close().catch(() => {});
    if (message.toLowerCase().includes('timeout')) {
      return { error: 'TIMEOUT', message };
    }
    return { error: 'NETWORK_ERROR', message };
  }

  // Detect auth redirect
  try {
    const currentUrl = bs.page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
      await bs.close().catch(() => {});
      return { error: 'AUTH_NOT_SUPPORTED', message: `Redirected to ${currentUrl}` };
    }
  } catch {
    // best-effort
  }

  const sessionId = randomUUID();
  const pageTitle = await bs.page.title().catch(() => undefined);

  const sessionData: SessionData = {
    id: sessionId,
    url,
    browserSession: bs,
    createdAt: Date.now(),
    consoleMessages,
    networkEntries,
    pageErrors,
  };

  storeSession(sessionData);

  return { sessionId, url, pageTitle };
}
