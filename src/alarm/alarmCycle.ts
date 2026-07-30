export interface AlarmCycleState {
  lastDropAt: number | null;
  acknowledged: boolean;
}

export function resetAlarmCycle(state: AlarmCycleState, stopAlarm: () => void): void {
  stopAlarm();
  state.lastDropAt = null;
  state.acknowledged = false;
}
