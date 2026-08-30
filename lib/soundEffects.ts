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
}

export const soundEffects = new SoundEffects();
