import { describe, expect, it } from 'vitest';
import {
  deriveThresholds,
  DropDetector,
  type DropDetectorConfig,
} from '../src/detection/dropDetector';

const config: DropDetectorConfig = {
  highThreshold: 0.6,
  lowThreshold: 0.3,
  minEventDurationMs: 30,
  maxEventDurationMs: 1000,
  debounceMs: 500,
  smoothingFactor: 1,
};

function feed(detector: DropDetector, samples: Array<[number, number]>) {
  return samples
    .map(([timestamp, score]) => detector.process(score, timestamp))
    .filter((event): event is NonNullable<typeof event> => event !== null);
}

describe('DropDetector', () => {
  it('does not let one calibration outlier erase the usable threshold', () => {
    const thresholds = deriveThresholds([0.004, 0.005, 0.006, 0.005, 0.004, 0.8], 0.55);

    expect(thresholds.highThreshold).toBeGreaterThan(0.02);
    expect(thresholds.highThreshold).toBeLessThan(0.2);
  });

  it('raises the threshold when the normal background stays noisy', () => {
    const quiet = deriveThresholds([0.004, 0.005, 0.006, 0.005, 0.004], 0.55);
    const noisy = deriveThresholds([0.01, 0.02, 0.015, 0.03, 0.012, 0.018], 0.55);

    expect(noisy.highThreshold).toBeGreaterThan(quiet.highThreshold);
  });

  it('recognizes one low-high-low drop waveform', () => {
    const events = feed(new DropDetector(config), [
      [0, 0.1],
      [100, 0.8],
      [250, 0.9],
      [500, 0.1],
    ]);

    expect(events).toHaveLength(1);
    expect(events[0]?.durationMs).toBe(400);
  });

  it('does not repeat a continuously high activity', () => {
    const events = feed(new DropDetector(config), [
      [0, 0.1],
      [100, 0.8],
      [400, 0.9],
      [800, 0.85],
      [1200, 0.9],
      [1300, 0.1],
    ]);

    expect(events).toHaveLength(0);
  });

  it('ignores activity shorter than the minimum duration', () => {
    const events = feed(new DropDetector(config), [
      [0, 0.1],
      [100, 0.8],
      [120, 0.1],
    ]);

    expect(events).toHaveLength(0);
  });

  it('ignores activity longer than the maximum duration', () => {
    const events = feed(new DropDetector(config), [
      [0, 0.1],
      [100, 0.8],
      [1200, 0.8],
      [1300, 0.1],
    ]);

    expect(events).toHaveLength(0);
  });

  it('does not count an event during the debounce period', () => {
    const events = feed(new DropDetector(config), [
      [0, 0.1],
      [100, 0.8],
      [500, 0.1],
      [600, 0.8],
      [900, 0.1],
      [1000, 0.8],
      [1400, 0.1],
    ]);

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.timestamp)).toEqual([500, 1400]);
  });

  it('counts two events with a reasonable interval', () => {
    const events = feed(new DropDetector(config), [
      [0, 0.1],
      [100, 0.8],
      [500, 0.1],
      [1200, 0.8],
      [1600, 0.1],
    ]);

    expect(events).toHaveLength(2);
  });

  it('cancels the current candidate without creating an event', () => {
    const detector = new DropDetector(config);
    detector.process(0.1, 0);
    detector.process(0.8, 100);
    detector.cancelCandidate();

    expect(detector.process(0.1, 500)).toBeNull();
    expect(detector.getSnapshot().state).toBe('idle');
  });
});
