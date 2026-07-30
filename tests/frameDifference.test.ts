import { describe, expect, it } from "vitest";
import {
  calculateActivityMeasurement,
  calculateActivityScore,
  isBroadMotion,
} from "../src/detection/frameDifference";

describe("calculateActivityScore", () => {
  it("returns almost zero for identical frames", () => {
    const frame = new Uint8ClampedArray([0, 10, 128, 255]);

    expect(calculateActivityScore(frame, frame)).toBeCloseTo(0, 6);
  });

  it("returns a small score for a few changed pixels", () => {
    const previous = new Uint8ClampedArray(100).fill(100);
    const current = previous.slice();
    current[0] = 180;
    current[1] = 180;

    expect(calculateActivityScore(current, previous)).toBeGreaterThan(0);
    expect(calculateActivityScore(current, previous)).toBeLessThan(0.1);
  });

  it("returns a high score for a broad frame change", () => {
    const previous = new Uint8ClampedArray(100).fill(20);
    const current = new Uint8ClampedArray(100).fill(220);

    expect(calculateActivityScore(current, previous)).toBeGreaterThan(0.7);
  });

  it("separates localized activity from broad motion", () => {
    const previous = new Uint8ClampedArray(64 * 64).fill(100);
    const localized = previous.slice();
    for (let y = 24; y < 40; y += 1) {
      for (let x = 28; x < 36; x += 1) localized[y * 64 + x] = 180;
    }
    const localizedMeasurement = calculateActivityMeasurement(localized, previous);

    expect(localizedMeasurement.activityScore).toBeGreaterThan(0);
    expect(localizedMeasurement.changedRegionFraction).toBeLessThan(0.2);
    expect(isBroadMotion(localizedMeasurement, 0.08)).toBe(false);

    const broad = new Uint8ClampedArray(64 * 64).fill(180);
    const broadMeasurement = calculateActivityMeasurement(broad, previous);
    expect(broadMeasurement.changedRegionFraction).toBe(1);
    expect(isBroadMotion(broadMeasurement, 0.08)).toBe(true);
  });

  it("rejects frames with different lengths", () => {
    expect(() => calculateActivityScore(new Uint8ClampedArray(2), new Uint8ClampedArray(1))).toThrow(
      /same length/i,
    );
  });
});
