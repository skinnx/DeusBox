import { settings } from '@/core/Settings.js';

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  init(): void {
    if (this.audioContext) return;
    try {
      this.audioContext = new AudioContext();
      this.masterGain = this.audioContext.createGain();
      this.sfxGain = this.audioContext.createGain();
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.audioContext.destination);
      this.updateVolume();
    } catch {
      console.warn('[AudioManager] Web Audio API not available');
    }
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  updateVolume(): void {
    const audio = settings.getAudio();
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setTargetAtTime(audio.master, this.audioContext.currentTime, 0.05);
    }
    if (this.sfxGain && this.audioContext) {
      this.sfxGain.gain.setTargetAtTime(audio.sfx, this.audioContext.currentTime, 0.05);
    }
  }

  playUIClick(): void {
    this.playTone(440, 0.05, 'square', 0.12);
  }

  playGodPower(): void {
    this.playTone(200, 0.1, 'sawtooth', 0.15);
  }

  playEntitySpawn(): void {
    if (!this.isReady()) return;
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(600, now + 0.15);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  playDisaster(): void {
    this.playNoise(0.15);
  }

  playCombat(): void {
    this.playTone(800, 0.03, 'square', 0.1);
  }

  playButtonHover(): void {
    this.playTone(800, 0.02, 'sine', 0.06);
  }

  playWarHorn(): void {
    if (!this.isReady()) return;
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.linearRampToValueAtTime(120, now + 0.3);
    osc.frequency.linearRampToValueAtTime(80, now + 0.5);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
    gain.gain.setValueAtTime(0.15, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  playLevelUp(): void {
    if (!this.isReady()) return;
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    const notes = [400, 500, 600, 800];
    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const t = now + i * 0.08;
      osc.frequency.setValueAtTime(notes[i]!, t);

      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.15);
    }
  }

  playCraft(): void {
    this.playTone(1200, 0.05, 'square', 0.08);
  }

  playTrade(): void {
    if (!this.isReady()) return;
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    const freqs = [2000, 2500, 3000];
    for (let i = 0; i < freqs.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.06;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqs[i]!, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.08);
    }
  }

  playSeasonChange(): void {
    if (!this.isReady()) return;
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(900, now + 0.15);
    osc.frequency.linearRampToValueAtTime(600, now + 0.3);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  playDeath(): void {
    if (!this.isReady()) return;
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.3);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  playBuildComplete(): void {
    if (!this.isReady()) return;
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    const freqs = [200, 300, 400];
    for (let i = 0; i < freqs.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.1;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freqs[i]!, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.2);
    }
  }

  setEnabled(enabled: boolean): void {
    settings.update({ audio: { enabled } });
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setTargetAtTime(
        enabled ? settings.getAudio().master : 0,
        this.audioContext.currentTime,
        0.05,
      );
    }
  }

  isEnabled(): boolean {
    return settings.getAudio().enabled;
  }

  private isReady(): boolean {
    return settings.getAudio().enabled && this.audioContext !== null && this.sfxGain !== null;
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.15): void {
    if (!this.isReady()) return;
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(now);
    osc.stop(now + duration);
  }

  private playNoise(duration: number): void {
    if (!this.isReady()) return;
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(gain);
    gain.connect(this.sfxGain!);

    source.start(now);
    source.stop(now + duration);
  }

  private static instance: AudioManager | null = null;

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }
}
