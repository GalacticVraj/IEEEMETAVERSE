/**
 * demo-driver.ts — one-click competition demo.
 *
 * Walks the REAL flow through the same public APIs a human uses: enter
 * simulation → intro flight → start the heatwave → wait for genuinely
 * measured grid stress → execute the strongest teaching decisions → let
 * protection and the director resolve the run → After-Action Review.
 * Nothing is faked and nothing bypasses the simulation: the driver simply
 * presses buttons on a schedule gated by real telemetry.
 */
import { asDecisionId, asSeconds } from '@app-types';
import { GRID_EVENT } from '@constants';
import type { AppRuntime } from '@infra';
import {
  AppMode,
  useAppFlowStore,
  useEventLogStore,
  useGridStore,
  useSimulationStore,
  useTutorialStore,
} from '@state';

import { useCameraStore } from '../../rendering/camera/camera-store';

import { PRESENTATION_SPEED, useDemoStore } from './demo-store';

/**
 * Fallback ticks if a stress threshold is never reached (still a real run).
 * Tuned to the C3 arc: harbor trip @300, baseload trip @600 — the demo acts
 * shortly after each shock, and ends the shift at night for the visual.
 */
const FIRST_ACTION_AT_TICK = 420;
const SECOND_ACTION_AT_TICK = 700;
const END_SHIFT_AT_TICK = 1500;

const commit = (runtime: AppRuntime, actionId: string): void => {
  const { tick } = useGridStore.getState();
  const { simTime } = useSimulationStore.getState();
  (runtime.kernel.events as { emit(name: string, payload: unknown): void }).emit(
    GRID_EVENT.DecisionCommitted,
    {
      decisionId: asDecisionId(`${actionId}-${tick}`),
      optionIndex: 0,
      simTime: asSeconds(simTime),
    },
  );
};

export interface DemoOptions {
  /**
   * Unattended presentation mode: watermark, 1.5× clock, and a restart from
   * the hero screen once the after-action review has been on screen long
   * enough to read. This is the `?demo` URL mode a judge leaves running.
   */
  readonly presentation?: boolean;
}

/** How long the after-action review holds before a presentation loop restarts. */
const AFTER_ACTION_DWELL_MS = 22_000;

/** Start the scripted demo. Returns a cancel function. */
export function startDemo(runtime: AppRuntime, options: DemoOptions = {}): () => void {
  let cancelled = false;
  let firstActionDone = false;
  let secondActionDone = false;
  let ended = false;
  const cleanups: (() => void)[] = [];

  const presentation = options.presentation ?? false;
  useDemoStore.getState().setActive(true);
  useDemoStore.getState().setPresentation(presentation);

  // Speed lives on the session, which scales the INTERVAL between ticks, not
  // the timestep inside them — so a 1.5× demo runs the same physics as a
  // played run, just sooner.
  runtime.session.setSpeed(presentation ? PRESENTATION_SPEED : 1);
  cleanups.push(() => {
    runtime.session.setSpeed(1);
    useDemoStore.getState().setActive(false);
    useDemoStore.getState().setPresentation(false);
  });

  const later = (ms: number, fn: () => void): void => {
    const timer = setTimeout(() => {
      if (!cancelled) fn();
    }, ms);
    cleanups.push(() => clearTimeout(timer));
  };

  /**
   * The next cycle of a presentation loop.
   *
   * Held so the canceller returned below stops the WHOLE loop, not just the
   * cycle that happened to be running when the caller cancelled — otherwise
   * pressing stop during cycle three would let cycle four start anyway.
   */
  let successorCancel: (() => void) | null = null;
  const restart = (): void => {
    // Retire this cycle cleanly first: its subscriptions are still attached,
    // and two drivers pressing the same buttons would double every decision.
    cancelled = true;
    for (const cleanup of cleanups) cleanup();
    successorCancel = startDemo(runtime, options);
  };

  // Step 1: Hero → Tutorial (the intro flight starts itself). The demo is a
  // hands-free showcase, so the persona tutorial stands down and the console
  // arrives fully assembled. Session-only: watching the demo must never cost
  // a curious player the tutorial they haven't seen yet.
  useTutorialStore.getState().skipForSession();
  if (useAppFlowStore.getState().mode === AppMode.Hero) {
    useAppFlowStore.getState().beginShift();
  }

  // Step 2: when the intro lands, start the heatwave after a beat.
  const startRun = (): void => {
    if (cancelled || useAppFlowStore.getState().mode !== AppMode.Tutorial) return;
    useEventLogStore.getState().clear();
    runtime.session.start('heatwave');
    useAppFlowStore.getState().selectCrisis('heatwave');
  };

  if (useCameraStore.getState().introDone) {
    later(1200, startRun);
  } else {
    const unsubscribeIntro = useCameraStore.subscribe((state) => {
      if (state.introDone) {
        unsubscribeIntro();
        later(1800, startRun);
      }
    });
    cleanups.push(unsubscribeIntro);
  }

  // Step 3: act on REAL telemetry (with tick fallbacks so the arc always lands).
  const unsubscribeGrid = useGridStore.subscribe((grid) => {
    if (cancelled || useAppFlowStore.getState().mode !== AppMode.ActiveCrisis) return;
    const stress = useSimulationStore.getState().maxLineLoading;

    if (!firstActionDone && (stress >= 0.8 || grid.tick >= FIRST_ACTION_AT_TICK)) {
      firstActionDone = true;
      commit(runtime, 'op-lights-commercial');
    }
    if (
      firstActionDone &&
      !secondActionDone &&
      (stress >= 0.95 || grid.tick >= SECOND_ACTION_AT_TICK)
    ) {
      secondActionDone = true;
      commit(runtime, 'op-ac-residential');
    }
    if (!ended && grid.tick >= END_SHIFT_AT_TICK) {
      ended = true;
      const darkZones = grid.zones.filter((zone) => (zone.state as string) === 'Blackout').length;
      runtime.session.stop();
      useAppFlowStore.getState().resolveCrisis(darkZones > 0 ? 'blackout' : 'success');
    }
  });
  cleanups.push(unsubscribeGrid);

  // The director may end the run on its own (GameEnded) — that path already
  // flows through bindAppFlow; the driver simply stops scheduling.
  let looping = false;
  const unsubscribeMode = useAppFlowStore.subscribe((state) => {
    if (state.mode !== AppMode.AfterAction) return;
    ended = true;

    // Presentation mode loops: hold the review long enough to read, return to
    // the hero screen, then run the whole thing again. `looping` guards the
    // subscription firing more than once for the same arrival.
    if (!presentation || looping || cancelled) return;
    looping = true;
    later(AFTER_ACTION_DWELL_MS, () => {
      useAppFlowStore.getState().returnToHero();
      // A beat on the hero screen before the next run — the loop should read
      // as a product restarting, not as a stutter.
      later(3500, () => {
        if (cancelled) return;
        restart();
      });
    });
  });
  cleanups.push(unsubscribeMode);

  return () => {
    cancelled = true;
    for (const cleanup of cleanups) cleanup();
    successorCancel?.();
    successorCancel = null;
  };
}
