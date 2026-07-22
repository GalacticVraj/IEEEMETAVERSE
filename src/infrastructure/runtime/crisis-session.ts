import { GameOutcome, KernelState, asScenarioId } from '@app-types';
import { GRID_EVENT } from '@constants';
import { GridGuardError } from '@core';
import type { GridEventMap, TypedEventBus } from '@core';
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
  readonly running: boolean;
  readonly activeScenarioId: string | null;
}

export interface CrisisSessionDeps {
  readonly kernel: SimulationKernel<GridEventMap>;
  /** Lazy — the registry resolves scenarios only when a run starts. */
  readonly registry: () => ScenarioRegistry;
  /** Re-runs a scenario's setup so scripted faults re-arm on restart. */
  readonly prepareScenario?: (scenario: ICrisisScenario) => void;
  readonly maxTicks?: number;
  readonly tickIntervalMs?: number;
}

export function createCrisisSession(deps: CrisisSessionDeps): CrisisSession {
  const { kernel } = deps;
  const maxTicks = deps.maxTicks ?? DEFAULT_MAX_TICKS;
  const tickIntervalMs = deps.tickIntervalMs ?? DEFAULT_TICK_INTERVAL_MS;

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
      (kernel.events as TypedEventBus<GridEventMap>).emit(GRID_EVENT.GameEnded, {
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
      deps.prepareScenario?.(scenario);

      active = scenario;
      activeId = id;
      kernel.start();
      interval = setInterval(tickOnce, tickIntervalMs);
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
      interval = setInterval(tickOnce, tickIntervalMs);
    },

    stop,

    get running(): boolean {
      return interval !== null;
    },

    get activeScenarioId(): string | null {
      return activeId;
    },
  };
}
