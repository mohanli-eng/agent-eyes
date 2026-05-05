/**
 * Unit tests for token-aware truncation utilities.
 *
 * These tests are intentionally written BEFORE implementation is complete,
 * following TDD. Run `pnpm test` — they should pass given the current
 * implementation in src/browser/truncation.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  estimateObjectTokens,
  truncateToTokenBudget,
  truncateString,
} from '../../src/browser/truncation.js';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('returns roughly chars/4 for ASCII text', () => {
    expect(estimateTokens('hello world')).toBe(Math.ceil(11 / 4));
  });
});

describe('estimateObjectTokens', () => {
  it('estimates based on JSON serialization', () => {
    const obj = { foo: 'bar' };
    const json = JSON.stringify(obj);
    expect(estimateObjectTokens(obj)).toBe(estimateTokens(json));
  });
});

describe('truncateToTokenBudget', () => {
  it('keeps all items when under budget', () => {
    const items = ['a', 'b', 'c'];
    const result = truncateToTokenBudget(items, 1000);
    expect(result.kept).toEqual(['a', 'b', 'c']);
    expect(result.truncated).toBe(false);
    expect(result.omittedCount).toBe(0);
  });

  it('truncates when budget exceeded', () => {
    // Each item is a 100-char string ≈ 25 tokens
    const items = Array.from({ length: 10 }, (_, i) =>
      `item ${i}: `.padEnd(100, 'x'),
    );
    // Budget of 50 tokens should fit ~2 items
    const result = truncateToTokenBudget(items, 50);
    expect(result.truncated).toBe(true);
    expect(result.kept.length).toBeLessThan(10);
    expect(result.omittedCount).toBe(10 - result.kept.length);
  });

  it('returns empty array when first item exceeds budget', () => {
    const items = ['x'.repeat(1000)];
    const result = truncateToTokenBudget(items, 10);
    expect(result.kept).toEqual([]);
    expect(result.truncated).toBe(true);
    expect(result.omittedCount).toBe(1);
  });
});

describe('truncateString', () => {
  it('returns string unchanged when under limit', () => {
    expect(truncateString('hello', 100)).toBe('hello');
  });

  it('adds ellipsis when truncated', () => {
    const result = truncateString('hello world this is long', 10);
    expect(result.length).toBe(10);
    expect(result.endsWith('...')).toBe(true);
  });
});
