import { describe, expect, it } from 'vitest';
import {
  calculateActivityMeasurement,
  isBroadMotion,
} from '../src/detection/frameDifference';

describe('frame difference noise handling', () => {
  it('keeps localized activity when sparse sensor noise touches the frame edges', () => {
    const previous = new Uint8ClampedArray(64 * 64).fill(100);
    const localizedWithNoise = previous.slice();
    for (let y = 24; y < 40; y += 1) {
      for (let x = 28; x < 36; x += 1) localizedWithNoise[y * 64 + x] = 180;
    }
    for (const index of [0, 63, 4032, 4095]) localizedWithNoise[index] = 180;

    const measurement = calculateActivityMeasurement(localizedWithNoise, previous);

    expect(measurement.activityScore).toBeGreaterThan(0.029);
    expect(isBroadMotion(measurement, 0.029)).toBe(false);
  });

  it('does not reject a short elongated reflection as broad motion', () => {
    const previous = new Uint8ClampedArray(64 * 64).fill(100);
    const reflection = previous.slice();
    for (let y = 0; y < 64; y += 1) {
      for (let x = 25; x <= 51; x += 1) {
        if ((x + y) % 4 === 0) reflection[y * 64 + x] = 180;
      }
    }

    const measurement = calculateActivityMeasurement(reflection, previous);

    expect(measurement.activityScore).toBeGreaterThan(0.08);
    expect(measurement.changedRegionFraction).toBeGreaterThan(0.55);
    expect(isBroadMotion(measurement, 0.029)).toBe(false);
  });
});
