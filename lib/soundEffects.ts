/**
 * Audio Synthesizer utilities using Web Audio API
 * Generates crisp, lightweight sounds without external audio assets.
 */

class SoundEffects {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('aviation_app_sound_muted');
        if (saved !== null) {
          this.muted = saved === 'true';
        }
      } catch {}
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(val: boolean): void {
    this.muted = val;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('aviation_app_sound_muted', val ? 'true' : 'false');
      } catch {}
    }
  }

  public toggleMute(): boolean {
    const newVal = !this.muted;
    this.setMuted(newVal);
    if (!newVal) {
      // Play a subtle positive chime on unmute
      this.playDoneJingle();
    }
    return newVal;
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.ctx || this.ctx.state === 'closed') {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * Plays an upbeat, crisp aviation confirmation jingle
   * Composed of a warm, melodic 3-tone arpeggio (C5 -> E5 -> G5 / C6 harmonic brilliance)
   */
  public playDoneJingle(): void {
    if (this.muted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      
      // Frequencies for a sparkling affirmative chord (e.g. C5 -> E5 -> G5 -> C6 chime)
      const notes = [
        { freq: 523.25, time: 0, duration: 0.12, gain: 0.18 },    // C5
        { freq: 659.25, time: 0.08, duration: 0.14, gain: 0.22 }, // E5
        { freq: 783.99, time: 0.16, duration: 0.18, gain: 0.25 }, // G5
        { freq: 1046.50, time: 0.24, duration: 0.35, gain: 0.28 } // C6 (sparkling finish)
      ];

      notes.forEach((note) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Use sine / triangle blend for a pure crystal bell chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.freq, now + note.time);

        // Gentle envelope attack and decay
        const startTime = now + note.time;
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(note.gain, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + note.duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + note.duration + 0.05);
      });
    } catch (e) {
      // Audio playback fails silently if browser policy restricts un-interacted audio
      console.debug('Audio playback note:', e);
    }
  }

  /**
   * Plays a celebratory, joyful "Yay!" / victory fanfare jingle
   * Synchronized with party poppers / confetti completion animations.
   * Features a rising fanfare arpeggio, rich multi-part chord, and glittering overtone chime.
   */
  public playYayJingle(): void {
    if (this.muted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // 1. Triumphant Fanfare Arpeggio: G4 -> C5 -> E5 -> G5 -> A5 -> C6
      const fanfareNotes = [
        { freq: 392.00, time: 0.00, duration: 0.10, gain: 0.20, type: 'triangle' as OscillatorType }, // G4
        { freq: 523.25, time: 0.08, duration: 0.10, gain: 0.22, type: 'sine' as OscillatorType },     // C5
        { freq: 659.25, time: 0.16, duration: 0.12, gain: 0.25, type: 'triangle' as OscillatorType }, // E5
        { freq: 783.99, time: 0.24, duration: 0.14, gain: 0.28, type: 'sine' as OscillatorType },     // G5
        { freq: 880.00, time: 0.32, duration: 0.15, gain: 0.30, type: 'triangle' as OscillatorType }, // A5
        { freq: 1046.50, time: 0.40, duration: 0.70, gain: 0.35, type: 'sine' as OscillatorType },    // High C6 (Victory peak)
      ];

      fanfareNotes.forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = n.type;
        osc.frequency.setValueAtTime(n.freq, now + n.time);

        const startTime = now + n.time;
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(n.gain, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + n.duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + n.duration + 0.05);
      });

      // 2. Celebratory Sustained Major Triad Harmony ("Yay!" warm swell with confetti flourish)
      const harmonyNotes = [
        { freq: 523.25, time: 0.40, duration: 0.75, gain: 0.18 }, // C5 root
        { freq: 659.25, time: 0.40, duration: 0.75, gain: 0.18 }, // E5 major third
        { freq: 783.99, time: 0.40, duration: 0.75, gain: 0.20 }, // G5 fifth
        { freq: 1318.51, time: 0.46, duration: 0.65, gain: 0.22 }, // E6 sparkling octave
        { freq: 1567.98, time: 0.52, duration: 0.60, gain: 0.18 }, // G6 party popper sparkle
      ];

      harmonyNotes.forEach((hn) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(hn.freq, now + hn.time);

        // Add subtle celebratory vibrato for a singing "Yay!" feel
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.setValueAtTime(6.0, now + hn.time); // 6Hz vibrato
        lfoGain.gain.setValueAtTime(4.0, now + hn.time);
        lfo.connect(osc.frequency);
        lfo.start(now + hn.time);
        lfo.stop(now + hn.time + hn.duration);

        const startTime = now + hn.time;
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(hn.gain, startTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + hn.duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + hn.duration + 0.05);
      });
    } catch (e) {
      console.debug('Yay sound error:', e);
    }
  }
}

export const soundEffects = new SoundEffects();
