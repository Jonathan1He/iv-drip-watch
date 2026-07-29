import { DEFAULT_SETTINGS, type Roi, type UserSettings } from '../types';

const SETTINGS_KEY = 'iv-drip-watch.settings.v1';

function clamp(value: number, minimum: number, maximum: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
}

function readRoi(value: unknown): Roi {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SETTINGS.roi };
  const candidate = value as Partial<Roi>;
  const width = clamp(Number(candidate.width), 0.1, 0.9, DEFAULT_SETTINGS.roi.width);
  const height = clamp(Number(candidate.height), 0.1, 0.9, DEFAULT_SETTINGS.roi.height);
  return {
    width,
    height,
    x: clamp(Number(candidate.x), 0, 1 - width, DEFAULT_SETTINGS.roi.x),
    y: clamp(Number(candidate.y), 0, 1 - height, DEFAULT_SETTINGS.roi.y),
  };
}

export function loadSettings(): UserSettings {
  try {
    const raw = globalThis.localStorage?.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, roi: { ...DEFAULT_SETTINGS.roi } };
    const candidate = JSON.parse(raw) as Partial<UserSettings>;
    return {
      sensitivity: clamp(Number(candidate.sensitivity), 0, 1, DEFAULT_SETTINGS.sensitivity),
      alertTimeoutSec: Math.round(
        clamp(Number(candidate.alertTimeoutSec), 15, 180, DEFAULT_SETTINGS.alertTimeoutSec),
      ),
      vibrationEnabled:
        typeof candidate.vibrationEnabled === 'boolean'
          ? candidate.vibrationEnabled
          : DEFAULT_SETTINGS.vibrationEnabled,
      soundEnabled:
        typeof candidate.soundEnabled === 'boolean'
          ? candidate.soundEnabled
          : DEFAULT_SETTINGS.soundEnabled,
      roi: readRoi(candidate.roi),
    };
  } catch {
    return { ...DEFAULT_SETTINGS, roi: { ...DEFAULT_SETTINGS.roi } };
  }
}

export function saveSettings(settings: UserSettings): void {
  try {
    globalThis.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing or a blocked storage policy should not stop monitoring.
  }
}
