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
} from '@state';

import { useCameraStore } from '../../rendering/camera/camera-store';

/** Fallback ticks if a stress threshold is never reached (still a real run). */
const FIRST_ACTION_AT_TICK = 400;
const SECOND_ACTION_AT_TICK = 800;
const END_SHIFT_AT_TICK = 1200;

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

/** Start the scripted demo. Returns a cancel function. */
export function startDemo(runtime: AppRuntime): () => void {
  let cancelled = false;
  let firstActionDone = false;
  let secondActionDone = false;
  let ended = false;
  const cleanups: (() => void)[] = [];

  const later = (ms: number, fn: () => void): void => {
    const timer = setTimeout(() => {
      if (!cancelled) fn();
    }, ms);
    cleanups.push(() => clearTimeout(timer));
  };

  // Step 1: Hero → CrisisSelect (the intro flight starts itself).
  if (useAppFlowStore.getState().mode === AppMode.Hero) {
    useAppFlowStore.getState().enterSimulation();
  }

  // Step 2: when the intro lands, start the heatwave after a beat.
  const startRun = (): void => {
    if (cancelled || useAppFlowStore.getState().mode !== AppMode.CrisisSelect) return;
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
  const unsubscribeMode = useAppFlowStore.subscribe((state) => {
    if (state.mode === AppMode.AfterAction) ended = true;
  });
  cleanups.push(unsubscribeMode);

  return () => {
    cancelled = true;
    for (const cleanup of cleanups) cleanup();
  };
}
