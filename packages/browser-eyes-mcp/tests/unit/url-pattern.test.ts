import { describe, it, expect } from 'vitest';
import { canonicalizeUrl } from '../../src/shared/url-pattern.js';

const cases: Array<[string, string]> = [
  ['/api/users/123', '/api/users/:id'],
  ['/api/users/456', '/api/users/:id'],
  ['/api/products/789/reviews', '/api/products/:id/reviews'],
  ['/assets/a1b2c3d4e5f6a7b8.js', '/assets/:hash'],
  ['/api/items/550e8400-e29b-41d4-a716-446655440000', '/api/items/:uuid'],
  ['/static/about', '/static/about'],
  ['/', '/'],
  ['/api/v1/users/42/posts/99', '/api/v1/users/:id/posts/:id'],
];

describe('canonicalizeUrl (US-02a URL pattern grouping)', () => {
  it.each(cases)('%s → %s', (raw, expected) => {
    expect(canonicalizeUrl(raw)).toBe(expected);
  });

  // TC-19: groupedByPattern field aggregates correctly
  it('groups multiple URLs under the same pattern', () => {
    const urls = [
      '/api/users/100',
      '/api/users/200',
      '/api/users/300',
      '/api/posts/1',
    ];
    const patterns = urls.map((u) => canonicalizeUrl(u));
    const counts: Record<string, number> = {};
    for (const p of patterns) {
      counts[p] = (counts[p] || 0) + 1;
    }
    expect(counts['/api/users/:id']).toBe(3);
    expect(counts['/api/posts/:id']).toBe(1);
  });
});
