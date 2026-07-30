export interface DropDetectorConfig {
  highThreshold: number;
  lowThreshold: number;
  minEventDurationMs: number;
  maxEventDurationMs: number;
  debounceMs: number;
  smoothingFactor: number;
}

export interface DropEvent {
  timestamp: number;
  durationMs: number;
  activityScore: number;
}

export interface DropDetectorSnapshot {
  state: 'idle' | 'active';
  smoothedScore: number;
  candidateStart: number | null;
  lastDropAt: number | null;
}

export const DEFAULT_DETECTOR_CONFIG: DropDetectorConfig = {
  highThreshold: 0.08,
  lowThreshold: 0.04,
  minEventDurationMs: 30,
  maxEventDurationMs: 1000,
  debounceMs: 500,
  smoothingFactor: 0.35,
};

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function deriveThresholds(
  baselineScores: readonly number[],
  sensitivity: number,
): Pick<DropDetectorConfig, 'highThreshold' | 'lowThreshold'> {
  const usableScores = baselineScores.filter((score) => Number.isFinite(score));
  const baselineMedian = median(usableScores);
  const absoluteDeviations = usableScores.map((score) => Math.abs(score - baselineMedian));
  const medianAbsoluteDeviation = median(absoluteDeviations);
  const robustNoiseEstimate = medianAbsoluteDeviation * 1.4826;
  const normalizedSensitivity = Math.min(1, Math.max(0, sensitivity));
  const margin = 0.04 - normalizedSensitivity * 0.02;
  const highThreshold = Math.min(
    0.9,
    Math.max(0.025, baselineMedian + robustNoiseEstimate * 3 + margin),
  );
  const lowThreshold = Math.min(
    highThreshold - 0.005,
    Math.max(0.01, highThreshold * (0.65 - normalizedSensitivity * 0.15)),
  );

  return { highThreshold, lowThreshold };
}

export class DropDetector {
  private state: 'idle' | 'active' = 'idle';
  private smoothedScore = 0;
  private candidateStart: number | null = null;
  private candidateInvalid = false;
  private lastDropAt: number | null = null;
  private previousTimestamp: number | null = null;

  constructor(private readonly config: DropDetectorConfig = DEFAULT_DETECTOR_CONFIG) {}

  process(activityScore: number, timestamp: number): DropEvent | null {
    if (!Number.isFinite(activityScore) || !Number.isFinite(timestamp)) return null;
    if (this.previousTimestamp !== null && timestamp < this.previousTimestamp) return null;

    const firstSample = this.previousTimestamp === null;
    this.previousTimestamp = timestamp;
    const factor = Math.min(1, Math.max(0, this.config.smoothingFactor));
    this.smoothedScore = firstSample
      ? activityScore
      : this.smoothedScore + (activityScore - this.smoothedScore) * factor;

    if (this.state === 'idle') {
      const cooldownOver =
        this.lastDropAt === null || timestamp - this.lastDropAt >= this.config.debounceMs;
      if (this.smoothedScore >= this.config.highThreshold && cooldownOver) {
        this.state = 'active';
        this.candidateStart = timestamp;
        this.candidateInvalid = false;
      }
      return null;
    }

    if (this.candidateStart === null) {
      this.state = 'idle';
      return null;
    }

    const durationMs = timestamp - this.candidateStart;
    if (durationMs > this.config.maxEventDurationMs) this.candidateInvalid = true;
    if (this.smoothedScore > this.config.lowThreshold) return null;

    const eventIsValid =
      !this.candidateInvalid &&
      durationMs >= this.config.minEventDurationMs &&
      durationMs <= this.config.maxEventDurationMs;
    const event: DropEvent | null = eventIsValid
      ? { timestamp, durationMs, activityScore: this.smoothedScore }
      : null;

    this.state = 'idle';
    this.candidateStart = null;
    this.candidateInvalid = false;
    if (event) this.lastDropAt = timestamp;
    return event;
  }

  cancelCandidate(): void {
    this.state = 'idle';
    this.smoothedScore = 0;
    this.candidateStart = null;
    this.candidateInvalid = false;
  }

  reset(): void {
    this.state = 'idle';
    this.smoothedScore = 0;
    this.candidateStart = null;
    this.candidateInvalid = false;
    this.lastDropAt = null;
    this.previousTimestamp = null;
  }

  getSnapshot(): DropDetectorSnapshot {
    return {
      state: this.state,
      smoothedScore: this.smoothedScore,
      candidateStart: this.candidateStart,
      lastDropAt: this.lastDropAt,
    };
  }
}
