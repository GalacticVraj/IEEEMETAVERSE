/**
 * web-audio-director.ts — the real (synthesized) sound layer.
 *
 * Everything is generated with WebAudio primitives — no asset files, no
 * network. A consumer in the strictest sense: it listens to the bus and the
 * advisor store and REACTS; it never drives or queries the simulation.
 * All cues are deliberately quiet and short — operations console, not arcade.
 */
import { GRID_EVENT } from '@constants';
import type { GridEventBus, Unsubscribe } from '@core';

import { useAdvisorStore, useUiStore } from '@state';

export interface AudioDirector {
  /** Attach listeners; audio starts on the first user gesture (browser policy). */
  start(): void;
  stop(): void;
}

const AMBIENT_GAIN = 0.012;
const CUE_GAIN = 0.06;

export function createAudioDirector(bus: GridEventBus): AudioDirector {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let ambientNodes: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  let subs: Unsubscribe[] = [];
  let unsubscribeStores: (() => void)[] = [];
  let gestureBound = false;

  const muted = (): boolean => useUiStore.getState().soundMuted;

  // ── Lazy context (must begin from a user gesture) ──
  const ensureContext = (): AudioContext | null => {
    if (typeof AudioContext === 'undefined') return null;
    if (context === null) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 1;
      master.connect(context.destination);
      startAmbient();
    }
    if (context.state === 'suspended') void context.resume();
    return context;
  };

  // ── Ambient bed: filtered noise ≈ distant city + wind ──
  const startAmbient = (): void => {
    if (context === null || master === null || ambientNodes !== null) return;
    const seconds = 4;
    const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      // Brown-ish noise: integrate white noise for a soft rumble.
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = context.createGain();
    gain.gain.value = muted() ? 0 : AMBIENT_GAIN;
    source.connect(filter).connect(gain).connect(master);
    source.start();
    ambientNodes = { source, gain };
  };

  // ── One-shot cue helpers (all nodes are short-lived; GC-friendly) ──
  const tone = (
    frequency: number,
    durationS: number,
    options: { type?: OscillatorType; gain?: number; delayS?: number } = {},
  ): void => {
    const ctx = ensureContext();
    if (ctx === null || master === null || muted()) return;
    const start = ctx.currentTime + (options.delayS ?? 0);
    const oscillator = ctx.createOscillator();
    oscillator.type = options.type ?? 'sine';
    oscillator.frequency.value = frequency;
    const gain = ctx.createGain();
    const peak = options.gain ?? CUE_GAIN;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + durationS);
    oscillator.connect(gain).connect(master);
    oscillator.start(start);
    oscillator.stop(start + durationS + 0.05);
  };

  const noiseBurst = (frequency: number, durationS: number, gainValue: number): void => {
    const ctx = ensureContext();
    if (ctx === null || master === null || muted()) return;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * durationS), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationS);
    source.connect(filter).connect(gain).connect(master);
    source.start();
  };

  // ── Named cues ──
  const cueRelayTrip = (): void => {
    noiseBurst(750, 0.14, 0.09); // breaker arc
    tone(85, 0.28, { type: 'sine', gain: 0.08, delayS: 0.02 }); // thunk
  };
  const cueBlackout = (): void => {
    tone(70, 0.7, { type: 'sine', gain: 0.09 });
    tone(52, 0.9, { type: 'sine', gain: 0.07, delayS: 0.12 });
  };
  const cueRecovery = (): void => {
    tone(523, 0.18, { gain: 0.045 });
    tone(784, 0.3, { gain: 0.045, delayS: 0.14 });
  };
  const cueWarning = (): void => {
    tone(220, 0.1, { type: 'triangle', gain: 0.05 });
    tone(220, 0.1, { type: 'triangle', gain: 0.05, delayS: 0.18 });
  };
  const cueAdvisor = (): void => tone(660, 0.07, { gain: 0.035 });
  const cueClick = (): void => tone(980, 0.03, { type: 'square', gain: 0.018 });
  const cueGameEnd = (held: boolean): void => {
    if (held) {
      tone(392, 0.25, { gain: 0.05 });
      tone(523, 0.25, { gain: 0.05, delayS: 0.18 });
      tone(659, 0.45, { gain: 0.05, delayS: 0.36 });
    } else {
      cueBlackout();
    }
  };

  // ── UI clicks via delegation (console buttons only) ──
  const onDocumentClick = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    if (target !== null && target.closest('.console-btn, .console-btn-primary') !== null) cueClick();
  };
  const onFirstGesture = (): void => {
    ensureContext();
  };

  return {
    start(): void {
      if (gestureBound) return;
      gestureBound = true;
      document.addEventListener('pointerdown', onFirstGesture, { passive: true });
      document.addEventListener('click', onDocumentClick, { passive: true });

      subs = [
        bus.on(GRID_EVENT.LineTripped, cueRelayTrip),
        bus.on(GRID_EVENT.LineRecovered, cueRecovery),
        bus.on(GRID_EVENT.ZoneBlackout, cueBlackout),
        bus.on(GRID_EVENT.DecisionRequested, cueWarning),
        bus.on(GRID_EVENT.GameEnded, (p) => cueGameEnd(p.outcome === 'Held')),
      ];

      let lastAdvisorId = 0;
      unsubscribeStores = [
        useAdvisorStore.subscribe((state) => {
          if (state.current !== null && state.current.id !== lastAdvisorId) {
            lastAdvisorId = state.current.id;
            cueAdvisor();
          }
        }),
        useUiStore.subscribe((state) => {
          if (ambientNodes !== null && context !== null) {
            ambientNodes.gain.gain.linearRampToValueAtTime(
              state.soundMuted ? 0 : AMBIENT_GAIN,
              context.currentTime + 0.2,
            );
          }
        }),
      ];
    },

    stop(): void {
      for (const unsubscribe of subs) unsubscribe();
      for (const unsubscribe of unsubscribeStores) unsubscribe();
      subs = [];
      unsubscribeStores = [];
      document.removeEventListener('pointerdown', onFirstGesture);
      document.removeEventListener('click', onDocumentClick);
      ambientNodes?.source.stop();
      ambientNodes = null;
      void context?.close();
      context = null;
    },
  };
}
