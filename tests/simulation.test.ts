import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIMULATION_RATE,
  getNextSimulationDropAt,
} from '../src/simulation/simulation';

describe('simulation scheduling', () => {
  it('starts in manual mode instead of scheduling drops automatically', () => {
    expect(DEFAULT_SIMULATION_RATE).toBe(0);
    expect(getNextSimulationDropAt(1_000, DEFAULT_SIMULATION_RATE)).toBe(Number.POSITIVE_INFINITY);
  });

  it('schedules an automatic drop only after the user selects a rate', () => {
    expect(getNextSimulationDropAt(1_000, 20)).toBe(4_000);
  });
});
