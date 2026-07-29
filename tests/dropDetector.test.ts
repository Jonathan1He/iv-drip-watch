import { describe, expect, it } from 'vitest';
import { DropDetector, type DropDetectorConfig } from '../src/detection/dropDetector';

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
});
