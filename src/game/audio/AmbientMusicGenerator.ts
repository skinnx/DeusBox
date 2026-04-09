import { settings } from '@/core/Settings.js';

type NoteFrequency = number;

const NOTES: Record<string, NoteFrequency> = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25,
};

const CHORD_PROGRESSIONS = {
  peaceful: [
    [NOTES.C4!, NOTES.E4!, NOTES.G4!],
    [NOTES.F3!, NOTES.A3!, NOTES.C4!],
    [NOTES.G3!, NOTES.B3!, NOTES.D4!],
    [NOTES.A3!, NOTES.C4!, NOTES.E4!],
    [NOTES.F3!, NOTES.A3!, NOTES.C4!],
    [NOTES.G3!, NOTES.B3!, NOTES.D4!],
    [NOTES.E3!, NOTES.G3!, NOTES.B3!],
    [NOTES.C3!, NOTES.E3!, NOTES.G3!],
  ],
  tense: [
    [NOTES.A3!, NOTES.C4!, NOTES.E4!],
    [NOTES.D3!, NOTES.F3!, NOTES.A3!],
    [NOTES.E3!, NOTES.G3!, NOTES.B3!],
    [NOTES.A3!, NOTES.C4!, NOTES.E4!],
  ],
  epic: [
    [NOTES.C4!, NOTES.E4!, NOTES.G4!],
    [NOTES.A3!, NOTES.C4!, NOTES.E4!],
    [NOTES.F3!, NOTES.A3!, NOTES.C4!],
    [NOTES.G3!, NOTES.B3!, NOTES.D4!],
  ],
};

const MELODY_SCALES = {
  peaceful: [NOTES.C4!, NOTES.D4!, NOTES.E4!, NOTES.G4!, NOTES.A4!, NOTES.C5!],
  tense: [NOTES.A3!, NOTES.C4!, NOTES.D4!, NOTES.E4!, NOTES.G4!],
  epic: [NOTES.C4!, NOTES.E4!, NOTES.G4!, NOTES.A4!, NOTES.C5!, NOTES.E5!],
};

export type MusicMood = 'peaceful' | 'tense' | 'epic';

export class AmbientMusicGenerator {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private padGain: GainNode | null = null;
  private melodyGain: GainNode | null = null;
  private bassGain: GainNode | null = null;
  private isPlaying = false;
  private currentMood: MusicMood = 'peaceful';
  private chordIndex = 0;
  private melodyTimer: ReturnType<typeof setTimeout> | null = null;
  private chordTimer: ReturnType<typeof setTimeout> | null = null;
  private activeOscillators: OscillatorNode[] = [];
  private destroyed = false;

  init(audioContext: AudioContext): void {
    this.ctx = audioContext;
    this.masterGain = audioContext.createGain();
    this.masterGain.gain.value = settings.getAudio().music * settings.getAudio().master;
    this.masterGain.connect(audioContext.destination);

    this.padGain = audioContext.createGain();
    this.padGain.gain.value = 0.12;
    this.padGain.connect(this.masterGain);

    this.melodyGain = audioContext.createGain();
    this.melodyGain.gain.value = 0.08;
    this.melodyGain.connect(this.masterGain);

    this.bassGain = audioContext.createGain();
    this.bassGain.gain.value = 0.1;
    this.bassGain.connect(this.masterGain);
  }

  start(): void {
    if (this.isPlaying || !this.ctx || this.destroyed) return;
    this.isPlaying = true;
    this.playNextChord();
    this.scheduleRandomMelody();
  }

  stop(): void {
    this.isPlaying = false;
    if (this.melodyTimer) clearTimeout(this.melodyTimer);
    if (this.chordTimer) clearTimeout(this.chordTimer);
    this.melodyTimer = null;
    this.chordTimer = null;
    this.stopAllOscillators();
  }

  setMood(mood: MusicMood): void {
    if (mood === this.currentMood) return;
    this.currentMood = mood;
    this.chordIndex = 0;
  }

  setVolume(volume: number): void {
    if (this.masterGain) {
      const audio = settings.getAudio();
      this.masterGain.gain.setTargetAtTime(volume * audio.master, this.ctx!.currentTime, 0.1);
    }
  }

  updateFromSettings(): void {
    if (this.masterGain && this.ctx) {
      const audio = settings.getAudio();
      this.masterGain.gain.setTargetAtTime(
        audio.music * audio.master,
        this.ctx.currentTime,
        0.1,
      );
    }
  }

  private playNextChord(): void {
    if (!this.isPlaying || !this.ctx || this.destroyed) return;

    const progression = CHORD_PROGRESSIONS[this.currentMood];
    const chord = progression[this.chordIndex % progression.length]!;

    for (const freq of chord) {
      this.playPadNote(freq, 4.0);
    }

    const bassNote = chord[0]! / 2;
    this.playBassNote(bassNote, 4.0);

    this.chordIndex++;
    this.chordTimer = setTimeout(() => this.playNextChord(), 4000);
  }

  private playPadNote(freq: number, duration: number): void {
    if (!this.ctx || !this.padGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(1, now + 0.8);
    env.gain.setValueAtTime(1, now + duration - 1.0);
    env.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(env);
    env.connect(this.padGain);

    osc.start(now);
    osc.stop(now + duration);
    this.activeOscillators.push(osc);
    osc.onended = () => {
      const idx = this.activeOscillators.indexOf(osc);
      if (idx >= 0) this.activeOscillators.splice(idx, 1);
    };
  }

  private playBassNote(freq: number, duration: number): void {
    if (!this.ctx || !this.bassGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(1, now + 0.3);
    env.gain.setValueAtTime(1, now + duration - 0.5);
    env.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(env);
    env.connect(this.bassGain);

    osc.start(now);
    osc.stop(now + duration);
    this.activeOscillators.push(osc);
    osc.onended = () => {
      const idx = this.activeOscillators.indexOf(osc);
      if (idx >= 0) this.activeOscillators.splice(idx, 1);
    };
  }

  private scheduleRandomMelody(): void {
    if (!this.isPlaying || this.destroyed) return;

    const delay = 2000 + Math.random() * 6000;
    this.melodyTimer = setTimeout(() => {
      this.playMelodyPhrase();
      this.scheduleRandomMelody();
    }, delay);
  }

  private playMelodyPhrase(): void {
    if (!this.ctx || !this.melodyGain) return;

    const scale = MELODY_SCALES[this.currentMood];
    const noteCount = 3 + Math.floor(Math.random() * 5);
    const noteLength = 0.3 + Math.random() * 0.4;

    let prevIndex = Math.floor(Math.random() * scale.length);
    const now = this.ctx.currentTime;

    for (let i = 0; i < noteCount; i++) {
      const step = Math.floor(Math.random() * 3) - 1;
      prevIndex = Math.max(0, Math.min(scale.length - 1, prevIndex + step));
      const freq = scale[prevIndex]!;

      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * noteLength);

      const env = this.ctx.createGain();
      const noteStart = now + i * noteLength;
      env.gain.setValueAtTime(0, noteStart);
      env.gain.linearRampToValueAtTime(1, noteStart + 0.05);
      env.gain.setValueAtTime(1, noteStart + noteLength * 0.6);
      env.gain.linearRampToValueAtTime(0, noteStart + noteLength);

      osc.connect(env);
      env.connect(this.melodyGain);

      osc.start(noteStart);
      osc.stop(noteStart + noteLength);
      this.activeOscillators.push(osc);
      osc.onended = () => {
        const idx = this.activeOscillators.indexOf(osc);
        if (idx >= 0) this.activeOscillators.splice(idx, 1);
      };
    }
  }

  private stopAllOscillators(): void {
    for (const osc of this.activeOscillators) {
      try { osc.stop(); } catch { /* already stopped */ }
    }
    this.activeOscillators.length = 0;
  }

  destroy(): void {
    this.destroyed = true;
    this.stop();
    if (this.masterGain) {
      this.masterGain.disconnect();
    }
  }
}
