import { describe, expect, it } from 'vitest';
import { calculateDripRate, getRecentDropTimes } from '../src/detection/dripRate';

describe('calculateDripRate', () => {
  it('does not invent a rate when there is not enough data', () => {
    expect(calculateDripRate([], 0)).toBeNull();
    expect(calculateDripRate([0], 0)).toBeNull();
    expect(calculateDripRate([0, 6000], 6000)).toBeNull();
  });

  it('returns the expected rate for stable intervals', () => {
    expect(calculateDripRate([0, 6000, 12000, 18000], 18000)).toBeCloseTo(10, 6);
  });

  it('uses a median interval so one outlier does not dominate', () => {
    expect(calculateDripRate([0, 6000, 12000, 42000, 48000], 48000)).toBeCloseTo(10, 6);
  });

  it('cleans up timestamps outside the sliding window', () => {
    expect(getRecentDropTimes([0, 6000, 12000], 80000, 60000)).toEqual([]);
    expect(getRecentDropTimes([0, 6000, 12000], 60000, 60000)).toEqual([6000, 12000]);
  });
});
