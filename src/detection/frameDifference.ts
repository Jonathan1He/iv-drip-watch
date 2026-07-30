export interface FrameDifferenceOptions {
  pixelDifferenceThreshold?: number;
}

export const DEFAULT_FRAME_DIFFERENCE_OPTIONS: Required<FrameDifferenceOptions> = {
  pixelDifferenceThreshold: 16,
};
export interface ActivityMeasurement {
  activityScore: number;
  changedRegionFraction: number;
}

function inferFrameWidth(length: number): number {
  if (length === 0) return 1;
  const squareRoot = Math.sqrt(length);
  return Number.isInteger(squareRoot) ? squareRoot : Math.max(1, Math.floor(squareRoot));
}

export function calculateActivityMeasurement(
  current: ArrayLike<number>,
  previous: ArrayLike<number>,
  options: FrameDifferenceOptions = {},
): ActivityMeasurement {
  if (current.length !== previous.length) throw new Error('Frames must have the same length');
  if (current.length === 0) return { activityScore: 0, changedRegionFraction: 0 };

  const frameWidth = inferFrameWidth(current.length);
  const frameHeight = Math.ceil(current.length / frameWidth);
  const threshold = Math.max(
    0,
    options.pixelDifferenceThreshold ?? DEFAULT_FRAME_DIFFERENCE_OPTIONS.pixelDifferenceThreshold,
  );
  let changedPixels = 0;
  let minX = frameWidth;
  let minY = frameHeight;
  let maxX = -1;
  let maxY = -1;

  for (let index = 0; index < current.length; index += 1) {
    if (Math.abs(current[index] - previous[index]) < threshold) continue;
    changedPixels += 1;
    const x = index % frameWidth;
    const y = Math.floor(index / frameWidth);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  const activityScore = changedPixels / current.length;
  const changedRegionFraction = changedPixels === 0
    ? 0
    : ((maxX - minX + 1) * (maxY - minY + 1)) / (frameWidth * frameHeight);
  return { activityScore, changedRegionFraction };
}

export function isBroadMotion(
  measurement: ActivityMeasurement,
  highThreshold: number,
  maxChangedRegionFraction = 0.55,
): boolean {
  return measurement.activityScore >= Math.max(0, highThreshold)
    && measurement.changedRegionFraction >= maxChangedRegionFraction;
}

export function calculateActivityScore(
  current: ArrayLike<number>,
  previous: ArrayLike<number>,
  options: FrameDifferenceOptions = {},
): number {
  return calculateActivityMeasurement(current, previous, options).activityScore;
}
