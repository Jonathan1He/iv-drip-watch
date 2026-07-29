export interface FrameDifferenceOptions {
  pixelDifferenceThreshold?: number;
}

export const DEFAULT_FRAME_DIFFERENCE_OPTIONS: Required<FrameDifferenceOptions> = {
  pixelDifferenceThreshold: 16,
};

export function calculateActivityScore(
  current: ArrayLike<number>,
  previous: ArrayLike<number>,
  options: FrameDifferenceOptions = {},
): number {
  if (current.length !== previous.length) throw new Error('Frames must have the same length');
  if (current.length === 0) return 0;

  let changedPixels = 0;
  const threshold = Math.max(
    0,
    options.pixelDifferenceThreshold ?? DEFAULT_FRAME_DIFFERENCE_OPTIONS.pixelDifferenceThreshold,
  );
  for (let index = 0; index < current.length; index += 1) {
    if (Math.abs(current[index] - previous[index]) >= threshold) changedPixels += 1;
  }

  return changedPixels / current.length;
}
