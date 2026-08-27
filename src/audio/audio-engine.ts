import { createToken } from '@core';
import type { GridEventBus, Token, Unsubscribe } from '@core';
import { Howl, Howler } from 'howler';

import { useUiStore } from '@state';

import type { MusicKey, SfxKey } from './manifest';
import { MUSIC_MANIFEST, SFX_MANIFEST } from './manifest';

export interface IAudioEngine {
  init(): void;
  attach(bus: GridEventBus): void;
  detach(): void;
  dispose(): void;

  /**
   * @param rate Optional playback rate (1 = nominal). Used to give each
   * generator its own voice — see `voice-rate.ts`.
   */
  playSfx(key: SfxKey, rate?: number): void;
  playMusic(stem: MusicKey, crossfadeSec?: number): void;
  stopMusic(fadeSec?: number): void;
  duck(active: boolean, durationSec?: number): void;

  setMasterVolume(volume: number): void;
  setSfxVolume(volume: number): void;
  setMusicVolume(volume: number): void;
  setMuted(muted: boolean): void;
}

export const AUDIO_ENGINE: Token<IAudioEngine> = createToken('AudioEngine');

export class AudioEngine implements IAudioEngine {
  private masterVolume = 1.0;
  private sfxVolume = 0.8;
  private musicVolume = 0.6;
  private muted = false;
  private isDucked = false;
  private currentMusicStem: MusicKey | null = null;

  private sfxHowls = new Map<SfxKey, Howl>();
  private sfxLoadFailed = new Set<SfxKey>();

  private musicHowls = new Map<MusicKey, Howl>();
  private musicLoadFailed = new Set<MusicKey>();

  private audioCtx: AudioContext | null = null;
  private unsubscribeUiStore: Unsubscribe | null = null;
  private initialized = false;

  public init(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (typeof window === 'undefined') return;

    // Read initial mute setting
    this.muted = useUiStore.getState().soundMuted;
    Howler.mute(this.muted);
    Howler.volume(this.masterVolume);

    // Preload SFX Howls
    (Object.keys(SFX_MANIFEST) as SfxKey[]).forEach((key) => {
      const def = SFX_MANIFEST[key];
      try {
        const howl = new Howl({
          src: [def.src],
          volume: this.sfxVolume * (def.volume ?? 1.0),
          onloaderror: () => {
            this.sfxLoadFailed.add(key);
            if (import.meta.env.DEV) {
              console.warn(`[AudioEngine] Audio asset failed to load: ${def.src}`);
            }
          },
        });
        this.sfxHowls.set(key, howl);
      } catch {
        this.sfxLoadFailed.add(key);
      }
    });

    // Preload Music Howls
    (Object.keys(MUSIC_MANIFEST) as MusicKey[]).forEach((key) => {
      const def = MUSIC_MANIFEST[key];
      try {
        const howl = new Howl({
          src: [def.src],
          loop: def.loop,
          volume: 0,
          onloaderror: () => {
            this.musicLoadFailed.add(key);
            if (import.meta.env.DEV) {
              console.warn(`[AudioEngine] Music asset failed to load: ${def.src}`);
            }
          },
        });
        this.musicHowls.set(key, howl);
      } catch {
        this.musicLoadFailed.add(key);
      }
    });
  }

  public attach(_bus: GridEventBus): void {
    if (!this.initialized) this.init();

    this.unsubscribeUiStore ??= useUiStore.subscribe((state) => {
      this.setMuted(state.soundMuted);
    });
  }

  public detach(): void {
    if (this.unsubscribeUiStore !== null) {
      this.unsubscribeUiStore();
      this.unsubscribeUiStore = null;
    }
  }

  public dispose(): void {
    this.detach();
    this.stopMusic(0);

    this.sfxHowls.forEach((howl) => howl.unload());
    this.sfxHowls.clear();

    this.musicHowls.forEach((howl) => howl.unload());
    this.musicHowls.clear();

    if (this.audioCtx !== null) {
      void this.audioCtx.close();
      this.audioCtx = null;
    }
    this.initialized = false;
  }

  public playSfx(key: SfxKey, rate = 1): void {
    if (this.muted) return;

    const howl = this.sfxHowls.get(key);
    const def = SFX_MANIFEST[key];

    if (howl !== undefined && !this.sfxLoadFailed.has(key) && howl.state() === 'loaded') {
      const vol = this.sfxVolume * (def.volume ?? 1.0);
      howl.volume(vol);
      // Howler's rate is per-Howl, not per-play, so it must be set on every
      // call — otherwise one detuned cue would retune every later use of the
      // same sample.
      howl.rate(rate);
      howl.play();
    } else {
      // Fallback to Web Audio procedural tone generator if asset missing or loading
      this.playProceduralFallback(key, rate);
    }
  }

  public playMusic(stem: MusicKey, crossfadeSec = 1.8): void {
    if (this.currentMusicStem === stem) return;

    const prevStem = this.currentMusicStem;
    this.currentMusicStem = stem;

    const targetHowl = this.musicHowls.get(stem);
    const targetVol = this.calculateTargetMusicVolume();

    // Fade out previous music stem
    if (prevStem !== null) {
      const prevHowl = this.musicHowls.get(prevStem);
      if (prevHowl?.playing()) {
        prevHowl.fade(prevHowl.volume(), 0, crossfadeSec * 1000);
        setTimeout(() => {
          if (this.currentMusicStem !== prevStem) {
            prevHowl.stop();
          }
        }, crossfadeSec * 1000);
      }
    }

    // Fade in new music stem
    if (targetHowl !== undefined && !this.musicLoadFailed.has(stem)) {
      if (!targetHowl.playing()) {
        targetHowl.volume(0);
        targetHowl.play();
      }
      targetHowl.fade(targetHowl.volume(), targetVol, crossfadeSec * 1000);
    }
  }

  public stopMusic(fadeSec = 1.0): void {
    if (this.currentMusicStem === null) return;

    const stem = this.currentMusicStem;
    this.currentMusicStem = null;

    const howl = this.musicHowls.get(stem);
    if (howl?.playing()) {
      if (fadeSec > 0) {
        howl.fade(howl.volume(), 0, fadeSec * 1000);
        setTimeout(() => howl.stop(), fadeSec * 1000);
      } else {
        howl.stop();
        howl.volume(0);
      }
    }
  }

  public duck(active: boolean, durationSec = 0.5): void {
    if (this.isDucked === active) return;
    this.isDucked = active;

    if (this.currentMusicStem !== null) {
      const howl = this.musicHowls.get(this.currentMusicStem);
      if (howl?.playing()) {
        const targetVol = this.calculateTargetMusicVolume();
        howl.fade(howl.volume(), targetVol, durationSec * 1000);
      }
    }
  }

  public setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    Howler.volume(this.masterVolume);
  }

  public setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  public setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.currentMusicStem !== null) {
      const howl = this.musicHowls.get(this.currentMusicStem);
      if (howl?.playing()) {
        howl.volume(this.calculateTargetMusicVolume());
      }
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    Howler.mute(muted);
  }

  private calculateTargetMusicVolume(): number {
    const duckMultiplier = this.isDucked ? 0.3 : 1.0;
    return this.musicVolume * duckMultiplier;
  }

  private playProceduralFallback(key: SfxKey, rate = 1): void {
    if (typeof window === 'undefined') return;
    try {
      if (this.audioCtx === null) {
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtxClass) return;
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume();
      }

      const def = SFX_MANIFEST[key];
      const tone = def.fallbackTone ?? { freq: 440, type: 'sine', durationS: 0.1 };
      const ctx = this.audioCtx;
      const start = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = tone.type ?? 'sine';
      // The synthesized fallback has no sample to resample, so the rate is
      // applied as a straight frequency scale — the same interval the Howl
      // path would produce, so a unit's voice is identical either way.
      osc.frequency.value = tone.freq * rate;

      const peakGain = this.sfxVolume * (def.volume ?? 1.0) * 0.15;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peakGain, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.durationS);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + tone.durationS + 0.02);
    } catch {
      // Ignore fallback errors quietly
    }
  }
}
