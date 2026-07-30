import { describe, expect, it } from 'vitest';
import { resetAlarmCycle, type AlarmCycleState } from '../src/alarm/alarmCycle';

describe('resetAlarmCycle', () => {
  it('stops the active alarm and clears the old monitoring timestamp', () => {
    const state: AlarmCycleState = {
      lastDropAt: 1_000,
      acknowledged: true,
    };
    let stopCalls = 0;

    resetAlarmCycle(state, () => {
      stopCalls += 1;
    });

    expect(stopCalls).toBe(1);
    expect(state).toEqual({ lastDropAt: null, acknowledged: false });
  });
});
