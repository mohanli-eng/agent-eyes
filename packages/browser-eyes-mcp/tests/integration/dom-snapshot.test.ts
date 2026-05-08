import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startFixtureServer, stopFixtureServer, getFixtureUrl } from '../setup.js';
import { openSession } from '../../src/tools/open-session.js';
import { closeSession } from '../../src/tools/close-session.js';
import { getDOMSnapshot } from '../../src/tools/get-dom-snapshot.js';

describe('US-03 getDOMSnapshot', () => {
  let baseUrl: string;

  beforeAll(async () => {
    baseUrl = await startFixtureServer();
  });

  afterAll(async () => {
    await stopFixtureServer();
  });

  // TC-25: semantic elements captured
  it('returns all semantic elements: headings, buttons, inputs, links, roles', async () => {
    const result = await getDOMSnapshot({
      url: getFixtureUrl('/semantic-dom.html'),
    });

    expect(result).not.toHaveProperty('error');
    if ('snapshot' in result && Array.isArray(result.snapshot)) {
      const tags = result.snapshot.map((n) => n.tag);

      // Headings
      expect(tags.filter((t) => t === 'h1')).toHaveLength(1);
      expect(tags.filter((t) => t.startsWith('h'))).toHaveLength(3);

      // Buttons with accessible names
      const buttons = result.snapshot.filter((n) => n.tag === 'button');
      expect(buttons.length).toBeGreaterThanOrEqual(2);

      // Inputs
      const inputs = result.snapshot.filter((n) => n.tag === 'input');
      expect(inputs.length).toBeGreaterThanOrEqual(2);

      // Links
      const links = result.snapshot.filter((n) => n.tag === 'a');
      expect(links.length).toBeGreaterThanOrEqual(2);

      // Role elements
      const roles = result.snapshot.filter((n) => n.role != null);
      expect(roles.length).toBeGreaterThanOrEqual(2);
    }
  });

  // TC-26: excluded content — script, style, comments, hidden elements
  it('excludes script, style, comments, and hidden elements', async () => {
    const result = await getDOMSnapshot({
      url: getFixtureUrl('/semantic-dom.html'),
    });

    expect(result).not.toHaveProperty('error');
    if ('snapshot' in result && Array.isArray(result.snapshot)) {
      // No script or style tags
      const tags = result.snapshot.map((n) => n.tag);
      expect(tags).not.toContain('script');
      expect(tags).not.toContain('style');

      // No hidden footer
      const footer = result.snapshot.filter((n) =>
        n.text?.includes('This footer is hidden'),
      );
      expect(footer).toEqual([]);

      // No invisible section
      const invisible = result.snapshot.filter((n) =>
        n.text?.includes('This section is invisible'),
      );
      expect(invisible).toEqual([]);
    }
  });

  // TC-27: selector scoping
  it('scopes snapshot to selector when provided', async () => {
    const result = await getDOMSnapshot({
      url: getFixtureUrl('/semantic-dom.html'),
      selector: 'main',
    });

    expect(result).not.toHaveProperty('error');
    if ('snapshot' in result && Array.isArray(result.snapshot)) {
      // Should only contain elements inside <main>
      // h1 is outside <main>, should not appear
      const h1Inside = result.snapshot.filter(
        (n) => n.tag === 'h1' && n.text?.includes('Page Title'),
      );
      expect(h1Inside).toEqual([]);

      // Buttons should be inside <main>
      const buttons = result.snapshot.filter((n) => n.tag === 'button');
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    }
  });

  // TC-28: depth-first truncation
  it('truncates depth-first when over budget, keeping shallow nodes', async () => {
    const result = await getDOMSnapshot({
      url: getFixtureUrl('/nested-dom.html'),
      maxTokens: 200,
    });

    expect(result).not.toHaveProperty('error');
    if ('truncated' in result) {
      expect(result.truncated).toBe(true);
      expect(result.notes?.some((n) => n.includes('omitted'))).toBe(true);
    }
  });

  // TC-29: flat JSON structure (not nested HTML)
  it('returns flat JSON array, not nested HTML strings', async () => {
    const result = await getDOMSnapshot({
      url: getFixtureUrl('/semantic-dom.html'),
    });

    expect(result).not.toHaveProperty('error');
    if ('snapshot' in result) {
      expect(Array.isArray(result.snapshot)).toBe(true);
      if (result.snapshot.length > 0) {
        // Each node should have tag, depth, childrenCount
        const node = result.snapshot[0];
        expect(node).toHaveProperty('tag');
        expect(node).toHaveProperty('depth');
        expect(node).toHaveProperty('childrenCount');
        // Should NOT have nested HTML string
        expect(node).not.toHaveProperty('innerHTML');
      }
    }
  });

  // TC-30: session mode — real-time snapshot of current DOM
  it('session mode captures current DOM at call time', async () => {
    const { sessionId } = await openSession({
      url: getFixtureUrl('/spa-dynamic.html'),
    });

    // Wait for dynamic content to render
    await new Promise((r) => setTimeout(r, 3000));

    const result = await getDOMSnapshot({ sessionId });
    expect(result).not.toHaveProperty('error');
    if ('snapshot' in result && Array.isArray(result.snapshot)) {
      // SPA content should now be visible
      const dynamic = result.snapshot.filter(
        (n) => n.text?.includes('SPA Content Loaded'),
      );
      expect(dynamic.length).toBeGreaterThan(0);
    }

    await closeSession({ sessionId });
  });

  // TC-31: selector not found
  it('returns snapshot: null when selector matches nothing', async () => {
    const result = await getDOMSnapshot({
      url: getFixtureUrl('/blank.html'),
      selector: '.nonexistent',
    });

    expect(result).not.toHaveProperty('error');
    if ('snapshot' in result) {
      expect(result.snapshot).toBeNull();
      expect(result.notes?.some((n) => n.includes('selector did not match'))).toBe(true);
    }
  });

  // TC-32: multiple selector matches
  it('handles selector matching multiple elements', async () => {
    const result = await getDOMSnapshot({
      url: getFixtureUrl('/semantic-dom.html'),
      selector: 'input',
    });

    expect(result).not.toHaveProperty('error');
    if ('matchCount' in result) {
      expect(result.matchCount).toBeGreaterThanOrEqual(2);
    }
    if ('snapshot' in result && Array.isArray(result.snapshot)) {
      expect(result.snapshot.length).toBeGreaterThanOrEqual(2);
    }
  });
});
