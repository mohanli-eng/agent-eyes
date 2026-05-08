import { describe, it, expect } from 'vitest';
import { rateLCP, rateCLS, rateINP, rateTBT } from '../../src/tools/get-perf-metrics.js';

// TC-35: CWV rating thresholds per Web Vitals official standard

describe('rateLCP', () => {
  const cases: Array<[number, string]> = [
    [1500, 'good'],
    [2500, 'good'],
    [2501, 'needs-improvement'],
    [3500, 'needs-improvement'],
    [4000, 'needs-improvement'],
    [4001, 'poor'],
    [6000, 'poor'],
  ];
  it.each(cases)('%dms → %s', (value, expected) => {
    expect(rateLCP(value)).toBe(expected);
  });
});

describe('rateCLS', () => {
  const cases: Array<[number, string]> = [
    [0, 'good'],
    [0.05, 'good'],
    [0.1, 'good'],
    [0.11, 'needs-improvement'],
    [0.2, 'needs-improvement'],
    [0.25, 'needs-improvement'],
    [0.26, 'poor'],
    [1.0, 'poor'],
  ];
  it.each(cases)('%f → %s', (value, expected) => {
    expect(rateCLS(value)).toBe(expected);
  });
});

describe('rateINP', () => {
  const cases: Array<[number, string]> = [
    [100, 'good'],
    [200, 'good'],
    [201, 'needs-improvement'],
    [400, 'needs-improvement'],
    [500, 'needs-improvement'],
    [501, 'poor'],
    [800, 'poor'],
  ];
  it.each(cases)('%dms → %s', (value, expected) => {
    expect(rateINP(value)).toBe(expected);
  });
});

describe('rateTBT', () => {
  const cases: Array<[number, string]> = [
    [100, 'good'],
    [200, 'good'],
    [201, 'needs-improvement'],
    [500, 'needs-improvement'],
    [600, 'needs-improvement'],
    [601, 'poor'],
    [1000, 'poor'],
  ];
  it.each(cases)('%dms → %s', (value, expected) => {
    expect(rateTBT(value)).toBe(expected);
  });
});
