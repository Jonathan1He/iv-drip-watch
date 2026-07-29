import { describe, expect, it } from "vitest";
import { calculateActivityScore } from "../src/detection/frameDifference";

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

  it("rejects frames with different lengths", () => {
    expect(() => calculateActivityScore(new Uint8ClampedArray(2), new Uint8ClampedArray(1))).toThrow(
      /same length/i,
    );
  });
});
