import { describe, expect, it } from 'vitest';
import {
  formatGndK,
  formatSignedGndK,
  formatSignedPct,
  formatSignedValue,
  NA,
} from '@/lib/format';
import { paddedDomain } from '@/components/charts/chartTheme';

describe('format helpers', () => {
  it('trims trailing zeros and groups thousands on request', () => {
    expect(formatGndK(44.32)).toBe('44.32');
    expect(formatGndK(167)).toBe('167');
    expect(formatGndK(50.6)).toBe('50.6');
    expect(formatGndK(-1703.06, 0, true)).toBe('-1,703');
    expect(formatGndK(1703.06, 2, true)).toBe('1,703.06');
  });

  it('never renders a signed zero', () => {
    expect(formatSignedGndK(0.004, 2)).toBe('0'); // rounds to 0 -> no sign
    expect(formatSignedGndK(-0.001, 2)).toBe('0');
    expect(formatSignedPct(0.0001)).toBe('0%');
    expect(formatSignedGndK(9.58)).toBe('+9.58');
    expect(formatSignedGndK(-10.16)).toBe('−10.16');
  });

  it('groups large signed values for headline display', () => {
    expect(formatSignedValue(-1703.06, 'GND_K', { decimals: 0, group: true })).toBe('−1,703');
  });

  it('returns the placeholder for non-finite input', () => {
    expect(formatGndK(null)).toBe(NA);
    expect(formatSignedGndK(undefined)).toBe(NA);
  });
});

describe('paddedDomain', () => {
  it('anchors the floor at 0 for non-negative bar data', () => {
    const [lo, hi] = paddedDomain([40, 60, 90], { includeZero: true });
    expect(lo).toBe(0);
    expect(hi).toBeGreaterThan(90);
  });

  it('extends below zero for diverging data', () => {
    const [lo, hi] = paddedDomain([-2133, 833, 662], { includeZero: true });
    expect(lo).toBeLessThan(-2133);
    expect(hi).toBeGreaterThan(833);
  });

  it('guards empty input', () => {
    expect(paddedDomain([null, undefined])).toEqual([0, 1]);
  });
});
