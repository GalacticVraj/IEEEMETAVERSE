import { GameOutcome, KernelState, asScenarioId } from '@app-types';
import { GRID_EVENT } from '@constants';
import { GridGuardError } from '@core';
import type { GridEventMap } from '@core';
import type { SimulationKernel } from '@kernel';
import type { ICrisisScenario, ScenarioRegistry } from '@scenarios';

/** Default run length: 1800 ticks × 100 ms = 3 simulated minutes of crisis. */
const DEFAULT_MAX_TICKS = 1800;
const DEFAULT_TICK_INTERVAL_MS = 100;

/**
 * The crisis session — the ONE driver of real time in the app. It owns the
 * setInterval that advances the kernel, feeds the active scenario its per-tick
 * scripting hook, and declares the run "Held" when the operator survives to
 * maxTicks. Loss outcomes (blackouts) are the director's responsibility.
 */
export interface CrisisSession {
  start(id: string): void;
  pause(): void;
  resume(): void;
  stop(): void;
  /**
   * Change how fast real time drives the simulation. 1 = normal, 1.5 = the
   * demo loop's pace.
   *
   * This scales the INTERVAL between ticks, not the timestep inside them, so
   * the physics is bit-for-bit identical — the same 1,800 ticks happen, just
   * sooner. Scaling the timestep instead would change every integration in
   * the frequency model and make a sped-up run a different run.
   */
  setSpeed(multiplier: number): void;
  readonly running: boolean;
  readonly activeScenarioId: string | null;
}

export interface CrisisSessionDeps {
  readonly kernel: SimulationKernel<GridEventMap>;
  /** Lazy — the registry resolves scenarios only when a run starts. */
  readonly registry: () => ScenarioRegistry;
  /**
   * Arms the scenario about to run: heals the grid, resets scenario-owned
   * global state, and calls `scenario.setup(context)`.
   *
   * REQUIRED, not optional. It used to be optional, and the composition root
   * separately called `setup()` on every scenario at registration — which
   * accidentally armed them and hid the fact that a session built without this
   * hook would start a scenario that had never been set up, then crash in
   * `teardown()` on an undefined fault API. Making it required turns "a
   * scenario is always armed before it runs" into a compile-time guarantee.
   */
  readonly prepareScenario: (scenario: ICrisisScenario) => void;
  readonly maxTicks?: number;
  readonly tickIntervalMs?: number;
}

export function createCrisisSession(deps: CrisisSessionDeps): CrisisSession {
  const { kernel } = deps;
  const maxTicks = deps.maxTicks ?? DEFAULT_MAX_TICKS;
  const baseTickIntervalMs = deps.tickIntervalMs ?? DEFAULT_TICK_INTERVAL_MS;
  /** Real-time multiplier. Physics is unchanged; only the interval moves. */
  let speed = 1;
  const currentIntervalMs = (): number => Math.max(10, Math.round(baseTickIntervalMs / speed));

  let interval: ReturnType<typeof setInterval> | null = null;
  let active: ICrisisScenario | null = null;
  let activeId: string | null = null;
  let ended = false;

  const clearLoop = (): void => {
    if (interval !== null) {
      clearInterval(interval);
      interval = null;
    }
  };

  const stop = (): void => {
    clearLoop();
    if (active !== null) {
      active.teardown();
      active = null;
    }
    activeId = null;
    if (kernel.state === KernelState.Running || kernel.state === KernelState.Paused) {
      kernel.stop();
    }
  };

  const tickOnce = (): void => {
    kernel.tick();
    const { clock } = kernel;
    active?.onTick({ tick: clock.tick, time: clock.time, timestep: clock.timestep });
    if (!ended && clock.tick >= maxTicks) {
      ended = true;
      kernel.events.emit(GRID_EVENT.GameEnded, {
        outcome: GameOutcome.Held,
        score: 100,
      });
      stop();
    }
  };

  return {
    start(id: string): void {
      stop();
      kernel.reset();
      ended = false;

      const scenario = deps.registry().get(asScenarioId(id));
      if (scenario === undefined) {
        throw new GridGuardError(`CrisisSession: unknown scenario "${id}"`);
      }
      deps.prepareScenario(scenario);

      active = scenario;
      activeId = id;
      kernel.start();
      interval = setInterval(tickOnce, currentIntervalMs());
    },

    pause(): void {
      if (interval === null) return;
      clearLoop();
      if (kernel.state === KernelState.Running) {
        kernel.pause();
      }
    },

    resume(): void {
      if (interval !== null || active === null || ended) return;
      if (kernel.state === KernelState.Paused) {
        kernel.resume();
      }
      interval = setInterval(tickOnce, currentIntervalMs());
    },

    stop,

    setSpeed(multiplier: number): void {
      const next = Math.max(0.25, Math.min(4, multiplier));
      if (next === speed) return;
      speed = next;
      // Re-arm the loop at the new cadence if one is already running. Without
      // this the change would only take effect after the next pause/resume.
      if (interval !== null) {
        clearLoop();
        interval = setInterval(tickOnce, currentIntervalMs());
      }
    },

    get running(): boolean {
      return interval !== null;
    },

    get activeScenarioId(): string | null {
      return activeId;
    },
  };
}
