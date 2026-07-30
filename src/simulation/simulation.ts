export const DEFAULT_SIMULATION_RATE = 0;

export function getNextSimulationDropAt(now: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return Number.POSITIVE_INFINITY;
  return now + 60_000 / rate;
}
