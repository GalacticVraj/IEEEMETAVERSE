/**
 * web-audio-director.ts — Event-reactive audio director for GridGuard.
 * Translates simulation events, state changes, and UI telemetry into audio engine calls.
 * Keep this file free of Howler specifics; all playback mechanics live in `AudioEngine`.
 */
import { KernelState } from '@app-types';
import { GRID_EVENT } from '@constants';
import type { GridEventBus, Unsubscribe } from '@core';

import {
  useAdvisorStore,
  useEventLogStore,
  useGridStore,
  useSimulationStore,
  useUiStore,
} from '@state';

import { AudioEngine } from './audio-engine';
import { MusicStateController } from './music/music-state';
import { voiceRateFor } from './voice-rate';

export interface AudioDirector {
  /** Attach listeners & start audio processing on first user gesture. */
  start(): void;
  stop(): void;
}

export function createAudioDirector(bus: GridEventBus, audioEngine?: AudioEngine): AudioDirector {
  const engine = audioEngine ?? new AudioEngine();
  const musicController = new MusicStateController('calm');

  let subs: Unsubscribe[] = [];
  let unsubscribeStores: (() => void)[] = [];
  let gestureBound = false;
  let lastSeenEventLogSeq = 0;
  let lastOnboardingStep = 1;
  let previousStressBand: 'calm' | 'tense' | 'critical' = 'calm';

  const checkDucking = (): void => {
    const isAdvisorSpeaking = useAdvisorStore.getState().current !== null;
    const isTourActive = useUiStore.getState().onboardingActive;
    engine.duck(isAdvisorSpeaking || isTourActive);
  };

  const updateAdaptiveMusic = (): void => {
    const stress = useSimulationStore.getState().maxLineLoading;
    const freq = useGridStore.getState().frequency;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const transitionStem = musicController.update(stress, freq, now);
    if (transitionStem !== null) {
      engine.playMusic(transitionStem);
    }
  };

  // Browsers keep an AudioContext suspended until a real user gesture, so the
  // opening music stem can only start from inside one. This runs once and then
  // detaches — previously it stayed bound and re-ran on every single pointerdown.
  const onFirstGesture = (): void => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('pointerdown', onFirstGesture);
    }
    engine.playMusic(musicController.getCurrentState());
  };

  const onDocumentClick = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    if (target !== null && target.closest('.console-btn, .console-btn-primary') !== null) {
      engine.playSfx('ui.click');
    }
  };

  return {
    start(): void {
      if (gestureBound) return;
      gestureBound = true;

      if (typeof document !== 'undefined') {
        document.addEventListener('pointerdown', onFirstGesture, { passive: true, once: true });
        document.addEventListener('click', onDocumentClick, { passive: true });
      }

      // Initialize audio engine
      engine.init();
      engine.attach(bus);

      // Event → SFX Mappings (11 core events mapped to distinct SFX)
      subs = [
        // 1. Action committed
        bus.on(GRID_EVENT.DecisionCommitted, () => {
          engine.playSfx('action.commit');
        }),

        // 2. Action error / line overloaded
        bus.on(GRID_EVENT.LineOverloaded, (payload) => {
          if (payload.loading >= 1.0) {
            engine.playSfx('action.error');
          }
        }),

        // 3. Breaker trip / protection trip
        bus.on(GRID_EVENT.LineTripped, () => {
          engine.playSfx('grid.breakerTrip');
        }),

        // 4. District / Zone blackout
        bus.on(GRID_EVENT.ZoneBlackout, () => {
          engine.playSfx('grid.blackout');
        }),

        // 5. Shift start
        bus.on(GRID_EVENT.KernelStateChanged, (payload) => {
          if (payload.to === KernelState.Running) {
            engine.playSfx('shift.start');
          }
        }),

        // 6. Replay started
        bus.on(GRID_EVENT.ReplayStarted, () => {
          engine.playSfx('shift.start');
        }),

        // 7. Shift end
        bus.on(GRID_EVENT.GameEnded, () => {
          engine.playSfx('shift.end');
        }),

        // 8. Rating reveal / replay finished
        bus.on(GRID_EVENT.ReplayFinished, () => {
          engine.playSfx('rating.reveal');
        }),

        // 9. PowerFlowSolved & stress band escalation alert sound
        bus.on(GRID_EVENT.PowerFlowSolved, (payload) => {
          const loading = payload.maxLoading;
          let currentBand: 'calm' | 'tense' | 'critical' = 'calm';
          if (loading >= 0.75) currentBand = 'critical';
          else if (loading >= 0.4) currentBand = 'tense';

          if (
            (previousStressBand === 'calm' && currentBand !== 'calm') ||
            (previousStressBand === 'tense' && currentBand === 'critical')
          ) {
            engine.playSfx('grid.stressEscalation');
          }
          previousStressBand = currentBand;

          updateAdaptiveMusic();
        }),

        // 10. Simulation tick updates adaptive music evaluation
        bus.on(GRID_EVENT.SimulationTick, () => {
          updateAdaptiveMusic();
        }),
      ];

      // Store Subscriptions for Ducking, Generator Losses, and Tour Step SFX
      unsubscribeStores = [
        // AI Advisor speaking state -> Ducking & cue
        useAdvisorStore.subscribe(() => {
          checkDucking();
        }),

        // Onboarding Tour active/step -> Ducking & tour step SFX
        useUiStore.subscribe((state) => {
          checkDucking();

          if (state.onboardingActive && state.onboardingStep !== lastOnboardingStep) {
            lastOnboardingStep = state.onboardingStep;
            engine.playSfx('tour.step');
          }
        }),

        // Generator loss detection via event log projection
        useEventLogStore.subscribe((state) => {
          const latest = state.entries[state.entries.length - 1];
          if (latest === undefined || latest.seq <= lastSeenEventLogSeq) return;
          lastSeenEventLogSeq = latest.seq;

          if (latest.focus?.kind === 'generator' && latest.severity === 'critical') {
            // Each machine gets its own pitch, derived from its id — so a
            // cascade sounds like several distinct units failing rather than
            // one sample stuttering. Deterministic, so replays match.
            engine.playSfx('grid.generatorLost', voiceRateFor(latest.focus.id));
          }
        }),
      ];

      // Initial check for ducking state
      checkDucking();
    },

    stop(): void {
      for (const unsubscribe of subs) unsubscribe();
      for (const unsubscribe of unsubscribeStores) unsubscribe();
      subs = [];
      unsubscribeStores = [];

      if (typeof document !== 'undefined') {
        document.removeEventListener('pointerdown', onFirstGesture);
        document.removeEventListener('click', onDocumentClick);
      }

      engine.dispose();
      musicController.reset();
      // Reset the director's own latches too — leaving these set meant a
      // restarted session inherited the previous run's stress band and could
      // skip the escalation cue entirely.
      previousStressBand = 'calm';
      lastSeenEventLogSeq = 0;
      lastOnboardingStep = 1;
      gestureBound = false;
    },
  };
}
