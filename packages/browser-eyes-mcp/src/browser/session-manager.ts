/**
 * Browser session lifecycle management.
 *
 * MVP: each session is short-lived (open → observe → close).
 * Phase 2: support keep-alive sessions across tool calls.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Session data — accumulates observations for the session lifetime
// ---------------------------------------------------------------------------

export interface CapturedMessage {
  level: 'error' | 'warning';
  message: string;
  source?: string;
  timestampMs: number;
}

export interface NetworkEntry {
  url: string;
  method: string;
  status: number;
  statusText: string;
  resourceType: string;
  startTimeMs: number;
  durationMs: number;
  redirectChain: Array<{ url: string; status: number }>;
}

export interface SessionData {
  id: string;
  url: string;
  browserSession: BrowserSession;
  createdAt: number;
  consoleMessages: CapturedMessage[];
  networkEntries: NetworkEntry[];
  pageErrors: CapturedMessage[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export async function createSession(): Promise<BrowserSession> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent:
      'Mozilla/5.0 (browser-eyes-mcp) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  return {
    browser,
    context,
    page,
    close: async () => {
      await context.close();
      await browser.close();
    },
  };
}
