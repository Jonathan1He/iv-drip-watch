import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/types';

describe('default settings', () => {
  it('uses a 20-second no-drop alarm timeout', () => {
    expect(DEFAULT_SETTINGS.alertTimeoutSec).toBe(20);
  });
});
