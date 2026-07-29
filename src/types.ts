export type AppStatus =
  | 'idle'
  | 'camera-ready'
  | 'calibrating'
  | 'monitoring'
  | 'paused'
  | 'alarming'
  | 'camera-error';

export interface Roi {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UserSettings {
  sensitivity: number;
  alertTimeoutSec: number;
  vibrationEnabled: boolean;
  soundEnabled: boolean;
  roi: Roi;
}

export const DEFAULT_SETTINGS: UserSettings = {
  sensitivity: 0.55,
  alertTimeoutSec: 45,
  vibrationEnabled: true,
  soundEnabled: true,
  roi: { x: 0.25, y: 0.2, width: 0.5, height: 0.6 },
};
