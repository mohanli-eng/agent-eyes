/**
 * Token-aware truncation utilities.
 *
 * MVP uses a simple chars/4 approximation for token estimation.
 * Future: swap in `gpt-tokenizer` or `tiktoken` for accuracy.
 */

/**
 * Approximate token count for a given string.
 * Rule of thumb: 1 token ≈ 4 chars for English/code.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens for a JSON-serializable object.
 */
export function estimateObjectTokens(obj: unknown): number {
  return estimateTokens(JSON.stringify(obj));
}

/**
 * Truncate an array of items to fit within a token budget.
 * Returns kept items and a flag indicating if truncation happened.
 */
export function truncateToTokenBudget<T>(
  items: T[],
  budget: number,
  formatter: (item: T) => string = (item) => JSON.stringify(item),
): { kept: T[]; truncated: boolean; omittedCount: number } {
  let usedTokens = 0;
  const kept: T[] = [];

  for (const item of items) {
    const itemTokens = estimateTokens(formatter(item));
    if (usedTokens + itemTokens > budget) {
      return {
        kept,
        truncated: true,
        omittedCount: items.length - kept.length,
      };
    }
    kept.push(item);
    usedTokens += itemTokens;
  }

  return { kept, truncated: false, omittedCount: 0 };
}

/**
 * Truncate a single string to a max char length, adding ellipsis.
 */
export function truncateString(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3) + '...';
}
