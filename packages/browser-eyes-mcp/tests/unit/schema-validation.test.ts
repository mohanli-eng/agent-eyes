import { describe, it, expect } from 'vitest';
import {
  GetConsoleErrorsInputSchema,
  OpenSessionInputSchema,
  CloseSessionInputSchema,
  GetNetworkRequestsInputSchema,
  GetDOMSnapshotInputSchema,
  GetPerfMetricsInputSchema,
} from '../../src/types.js';

// TC-10: token budget boundary validation
// TC-11: includeWarnings default
// TC-43: invalid URL → INVALID_URL
// TC-50: non http/https URL

describe('GetConsoleErrorsInputSchema', () => {
  it('accepts minimal valid input', () => {
    const result = GetConsoleErrorsInputSchema.safeParse({ url: 'https://example.com' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.waitMs).toBe(5000);
      expect(result.data.maxTokens).toBe(2000);
      expect(result.data.includeWarnings).toBe(false);
    }
  });

  it('accepts optional sessionId', () => {
    const result = GetConsoleErrorsInputSchema.safeParse({
      sessionId: 'abc-123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing url AND sessionId', () => {
    const result = GetConsoleErrorsInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid URL protocol at handler level (ftp:// - schema allows, handler rejects)', async () => {
    // Zod .url() accepts ftp:// — protocol validation is done in handler
    const result = GetConsoleErrorsInputSchema.safeParse({ url: 'ftp://files.com' });
    expect(result.success).toBe(true); // schema allows, but handler will reject
  });

  it('defaults maxTokens to 2000', () => {
    const result = GetConsoleErrorsInputSchema.safeParse({ url: 'https://example.com' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.maxTokens).toBe(2000);
  });

  it('clamps maxTokens at bounds', () => {
    const low = GetConsoleErrorsInputSchema.safeParse({ url: 'https://x.com', maxTokens: 100 });
    const high = GetConsoleErrorsInputSchema.safeParse({ url: 'https://x.com', maxTokens: 20000 });
    expect(low.success).toBe(false);
    expect(high.success).toBe(false);
  });
});

describe('OpenSessionInputSchema', () => {
  it('accepts valid https URL', () => {
    const result = OpenSessionInputSchema.safeParse({ url: 'https://example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects non-url string', () => {
    const result = OpenSessionInputSchema.safeParse({ url: 'not-a-url' });
    expect(result.success).toBe(false);
  });
});

describe('CloseSessionInputSchema', () => {
  it('accepts valid sessionId', () => {
    const result = CloseSessionInputSchema.safeParse({ sessionId: 'abc-def-123' });
    expect(result.success).toBe(true);
  });

  it('rejects missing sessionId', () => {
    const result = CloseSessionInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('GetNetworkRequestsInputSchema', () => {
  it('accepts url-only input with defaults', () => {
    const result = GetNetworkRequestsInputSchema.safeParse({ url: 'https://example.com' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slowThresholdMs).toBe(1000);
      expect(result.data.waitMs).toBe(5000);
    }
  });

  it('accepts sessionId input', () => {
    const result = GetNetworkRequestsInputSchema.safeParse({ sessionId: 'sess-1' });
    expect(result.success).toBe(true);
  });
});

describe('GetDOMSnapshotInputSchema', () => {
  it('accepts url with optional selector', () => {
    const result = GetDOMSnapshotInputSchema.safeParse({
      url: 'https://example.com',
      selector: 'main',
    });
    expect(result.success).toBe(true);
  });

  it('accepts sessionId', () => {
    const result = GetDOMSnapshotInputSchema.safeParse({ sessionId: 'sess-1' });
    expect(result.success).toBe(true);
  });
});

describe('GetPerfMetricsInputSchema', () => {
  it('accepts valid input with defaults', () => {
    const result = GetPerfMetricsInputSchema.safeParse({ url: 'https://example.com' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.waitMs).toBe(8000);
    }
  });

  it('accepts sessionId', () => {
    const result = GetPerfMetricsInputSchema.safeParse({ sessionId: 'sess-1' });
    expect(result.success).toBe(true);
  });
});
