export interface DripRateOptions {
  windowMs?: number;
  minSamples?: number;
}

export function getRecentDropTimes(
  dropTimes: readonly number[],
  now: number,
  windowMs = 60_000,
): number[] {
  const start = now - Math.max(1, windowMs);
  return dropTimes
    .filter((timestamp) => Number.isFinite(timestamp) && timestamp > start && timestamp <= now)
    .sort((left, right) => left - right);
}

export function calculateDripRate(
  dropTimes: readonly number[],
  now: number,
  options: DripRateOptions = {},
): number | null {
  const recentTimes = getRecentDropTimes(dropTimes, now, options.windowMs);
  const minSamples = Math.max(3, options.minSamples ?? 3);
  if (recentTimes.length < minSamples) return null;

  const intervals: number[] = [];
  for (let index = 1; index < recentTimes.length; index += 1) {
    const interval = recentTimes[index] - recentTimes[index - 1];
    if (interval > 0) intervals.push(interval);
  }
  if (intervals.length === 0) return null;

  intervals.sort((left, right) => left - right);
  const middle = Math.floor(intervals.length / 2);
  const medianInterval =
    intervals.length % 2 === 0
      ? (intervals[middle - 1] + intervals[middle]) / 2
      : intervals[middle];
  return medianInterval > 0 ? 60_000 / medianInterval : null;
}
