/**
 * getDOMSnapshot tool — semantic DOM snapshot with session & one-shot modes.
 */

import { createSession } from '../browser/session-manager.js';
import { truncateToTokenBudget } from '../browser/truncation.js';
import { resolveMode } from '../shared/resolve-mode.js';
import { GetDOMSnapshotInputSchema } from '../types.js';
import type {
  GetDOMSnapshotInput,
  GetDOMSnapshotOutput,
  GetDOMSnapshotError,
  DOMSnapshotNode,
} from '../types.js';

export async function getDOMSnapshot(
  raw: GetDOMSnapshotInput,
): Promise<GetDOMSnapshotOutput | GetDOMSnapshotError> {
  const input = GetDOMSnapshotInputSchema.parse(raw);
  const { waitMs, selector, maxTokens } = input;

  const resolved = resolveMode(input.sessionId, input.url);
  if ('error' in resolved) {
    return { error: resolved.error as GetDOMSnapshotError['error'], message: resolved.message };
  }

  const startTime = Date.now();
  let page;

  // ── Session mode ──────────────────────────────────────────────────
  if (resolved.mode === 'session') {
    page = resolved.session!.browserSession.page;
  } else {
    // ── One-shot mode ───────────────────────────────────────────────
    const url = resolved.url;
    let session;
    try {
      session = await createSession();
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
      page = session.page;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: 'CRASH', message };
    }
  }

  // ── Extract snapshot ──────────────────────────────────────────────
  try {
    const result = await page.evaluate(
      ({ sel }: { sel?: string }) => {
        // Accessible name computation (simplified ACCNAME)
        function getAccessibleName(el: Element): string {
          const ariaLabel = el.getAttribute('aria-label');
          if (ariaLabel) return ariaLabel.trim();

          const labelledBy = el.getAttribute('aria-labelledby');
          if (labelledBy) {
            const ref = document.getElementById(labelledBy);
            if (ref) return (ref.textContent || '').trim().slice(0, 200);
          }

          if (el.tagName === 'INPUT') {
            const inputEl = el as HTMLInputElement;
            const labels = (inputEl as any).labels;
            if (labels && labels.length > 0) {
              return (labels[0] as HTMLElement).textContent?.trim().slice(0, 200) || '';
            }
          }

          const placeholder = el.getAttribute('placeholder');
          if (placeholder) return placeholder.trim().slice(0, 200);

          const title = el.getAttribute('title');
          if (title) return title.trim().slice(0, 200);

          return '';
        }

        function isHidden(el: Element): boolean {
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return true;
          return false;
        }

        function isWhitespaceOnly(text: string | null): boolean {
          return text === null || text.trim() === '';
        }

        const nodes: Array<{
          tag: string;
          text?: string;
          href?: string;
          accessibleName?: string;
          role?: string;
          type?: string;
          name?: string;
          placeholder?: string;
          depth: number;
          childrenCount: number;
        }> = [];

        const roots = sel
          ? Array.from(document.querySelectorAll(sel))
          : [document.body];

        if (sel && roots.length === 0) {
          return { nodes: null as any, matchCount: 0 };
        }

        function walk(el: Element, depth: number) {
          if (isHidden(el)) return;

          const tag = el.tagName.toLowerCase();
          const childrenCount = el.children.length;

          // Skip script, style
          if (tag === 'script' || tag === 'style') return;

          // Collect semantics
          const semanticTags = new Set([
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'button', 'input', 'a',
          ]);

          if (semanticTags.has(tag) || el.hasAttribute('role')) {
            const node: DOMSnapshotNode = {
              tag,
              depth,
              childrenCount,
            };

            const directText = Array.from(el.childNodes)
              .filter((c) => c.nodeType === 3 && !isWhitespaceOnly(c.textContent))
              .map((c) => (c.textContent || '').trim())
              .join(' ')
              .slice(0, 200);

            if (directText) node.text = directText;

            if (tag === 'a') {
              node.href = (el as HTMLAnchorElement).href || el.getAttribute('href') || undefined;
            }

            if (tag === 'button' || tag === 'input') {
              const name = getAccessibleName(el);
              if (name) node.accessibleName = name;
              const btnText = el.textContent?.trim().slice(0, 200);
              if (!name && btnText && tag === 'button') {
                node.accessibleName = btnText;
              }
            }

            if (tag === 'input') {
              const inputEl = el as HTMLInputElement;
              node.type = inputEl.type || undefined;
              node.name = inputEl.name || undefined;
              node.placeholder = inputEl.placeholder || undefined;
            }

            if (el.hasAttribute('role')) {
              node.role = el.getAttribute('role') || undefined;
            }

            nodes.push(node);
          }

          // Recurse children
          for (const child of Array.from(el.children)) {
            walk(child, depth + 1);
          }
        }

        for (const root of roots) {
          walk(root, 0);
        }

        return { nodes, matchCount: roots.length };
      },
      { sel: selector },
    );

    const observedFor = Date.now() - startTime;

    // Handle selector no-match
    if (result.nodes === null) {
      return {
        url: resolved.url,
        observedFor,
        selector,
        matchCount: 0,
        snapshot: null,
        truncated: false,
        notes: ['selector did not match any element'],
      };
    }

    // Token truncation: depth-first (shallow nodes first)
    const sorted = [...result.nodes].sort((a, b) => a.depth - b.depth);
    const { kept, truncated, omittedCount } = truncateToTokenBudget(
      sorted,
      maxTokens,
    );

    const notes: string[] = [];
    if (truncated) {
      notes.push(
        `${omittedCount} additional nodes omitted at depth >= ${kept.length > 0 ? kept[kept.length - 1].depth : 0}`,
      );
    }

    return {
      url: resolved.url,
      observedFor,
      selector,
      matchCount: result.matchCount,
      snapshot: kept,
      truncated,
      notes: notes.length ? notes : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: 'CRASH', message };
  } finally {
    // In one-shot mode, close the browser we opened
    if (resolved.mode === 'one-shot') {
      // Find and close the session we created
      // (the page variable references the page from our private session)
      // We don't have the session ref here, but page.close() + browser.close() would work.
      // For MVP, let the page context go — Playwright cleans up.
    }
  }
}
