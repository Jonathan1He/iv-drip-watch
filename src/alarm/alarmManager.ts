export interface AlarmOptions {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export class AlarmManager {
  private audioContext: AudioContext | null = null;
  private beepTimer: number | null = null;
  private vibrationTimer: number | null = null;
  private active = false;

  async initialize(): Promise<void> {
    try {
      if (!this.audioContext && 'AudioContext' in globalThis) {
        this.audioContext = new AudioContext();
      }
      if (this.audioContext?.state === 'suspended') await this.audioContext.resume();
    } catch {
      this.audioContext = null;
    }
  }

  start(options: AlarmOptions): void {
    this.stop();
    this.active = true;
    if (options.soundEnabled && this.audioContext) {
      this.beep();
      this.beepTimer = window.setInterval(() => this.beep(), 700);
    }
    if (options.vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate([350, 180, 350, 800]);
      this.vibrationTimer = window.setInterval(
        () => navigator.vibrate([350, 180, 350, 800]),
        1_680,
      );
    }
  }

  async test(options: AlarmOptions, durationMs = 3_500): Promise<void> {
    await this.initialize();
    this.start(options);
    window.setTimeout(() => this.stop(), durationMs);
  }

  stop(): void {
    if (this.beepTimer !== null) window.clearInterval(this.beepTimer);
    if (this.vibrationTimer !== null) window.clearInterval(this.vibrationTimer);
    this.beepTimer = null;
    this.vibrationTimer = null;
    this.active = false;
    if ('vibrate' in navigator) navigator.vibrate(0);
  }

  isActive(): boolean {
    return this.active;
  }

  private beep(): void {
    if (!this.audioContext) return;
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const now = this.audioContext.currentTime;
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.setValueAtTime(660, now + 0.16);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    oscillator.connect(gain);
    gain.connect(this.audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.32);
  }
}
