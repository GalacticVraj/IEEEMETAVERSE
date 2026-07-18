import type { Seconds, SimulationState } from '@app-types';
import { DEFAULT_TIMESTEP, GRID_EVENT } from '@constants';
import { NoopLogger, createEventBus, createToken } from '@core';
import type {
  Clock,
  GridEventBus,
  GridEventMap,
  Logger,
  Rng,
  SimulationSystem,
  SystemContext,
  Token,
} from '@core';

import { createSimulationStateMachine } from './fsm/simulation-state-machine';
import type { SimulationStateMachine } from './fsm/simulation-state-machine';
import { createLifecycleManager } from './lifecycle/lifecycle-manager';
import { createSystemRegistry } from './registry/system-registry';
import type { SystemRegistry } from './registry/system-registry';
import { createMulberry32 } from './rng/mulberry32';
import { createScheduler } from './scheduler/scheduler';
import { createSimClock } from './time/sim-clock';

export interface SimulationKernelOptions {
  /** Seed that makes the entire run reproducible. */
  readonly seed: number;
  /** Fixed timestep; defaults to {@link DEFAULT_TIMESTEP}. */
  readonly timestep?: Seconds;
  /** Inject a shared bus (e.g. for tests); otherwise a fresh one is created. */
  readonly events?: GridEventBus;
  /** Inject a logger; defaults to {@link NoopLogger}. */
  readonly logger?: Logger;
}

/**
 * The Simulation Kernel: the deterministic engine core. It owns time (clock),
 * randomness (rng), the lifecycle state machine (fsm), the system registry, and
 * the event bus, and it exposes the tick loop. It is domain-agnostic — it knows
 * nothing about power flow or cascades, only how to drive registered systems.
 *
 * Determinism guarantee: given the same seed, the same registered systems, and
 * the same sequence of `tick()`/`transition()` calls, the emitted event stream
 * is identical. This is what replay verification depends on.
 */
export interface SimulationKernel {
  readonly events: GridEventBus;
  readonly clock: Clock;
  readonly rng: Rng;
  readonly fsm: SimulationStateMachine;
  readonly registry: SystemRegistry;
  /** Register a system (before `boot`). */
  register(system: SimulationSystem): void;
  /** Initialize all registered systems and bridge FSM → event bus. */
  boot(): void;
  /** Advance one fixed timestep: step systems, then emit `SimulationTick`. */
  tick(): void;
  /** Request a lifecycle state transition (validated by the FSM). */
  transition(target: SimulationState): void;
  /** Reset systems, clock, and FSM to their initial state. */
  reset(): void;
  /** Dispose systems and tear down the bus. */
  dispose(): void;
}

export const SIMULATION_KERNEL: Token<SimulationKernel> = createToken('SimulationKernel');

export function createSimulationKernel(options: SimulationKernelOptions): SimulationKernel {
  const events: GridEventBus = options.events ?? createEventBus<GridEventMap>();
  const logger = (options.logger ?? NoopLogger).child('kernel');
  const timestep = options.timestep ?? DEFAULT_TIMESTEP;

  const clock = createSimClock(timestep);
  const rng = createMulberry32(options.seed);
  const fsm = createSimulationStateMachine();
  const registry = createSystemRegistry();
  const scheduler = createScheduler();
  const lifecycle = createLifecycleManager();

  // Bridge every validated FSM change onto the event bus so consumers observe
  // lifecycle changes exactly like any other simulation event.
  fsm.onChange(({ from, to }) => {
    events.emit(GRID_EVENT.SimStateChanged, { from, to, tick: clock.tick });
  });

  const context: SystemContext = { events, rng, clock, logger };
  let booted = false;

  return {
    events,
    clock,
    rng,
    fsm,
    registry,
    register(system: SimulationSystem): void {
      registry.register(system);
    },
    boot(): void {
      if (booted) return;
      lifecycle.init(registry.all(), context);
      booted = true;
      logger.info('Simulation kernel booted', { systemCount: registry.all().length });
    },
    tick(): void {
      clock.advance();
      const tickContext = { tick: clock.tick, time: clock.time, timestep: clock.timestep };
      scheduler.step(registry.all(), tickContext);
      events.emit(GRID_EVENT.SimulationTick, {
        tick: clock.tick,
        simTime: clock.time,
        timestep: clock.timestep,
      });
    },
    transition(target: SimulationState): void {
      fsm.transition(target);
    },
    reset(): void {
      lifecycle.reset(registry.all());
      clock.reset();
      fsm.reset();
    },
    dispose(): void {
      lifecycle.dispose(registry.all());
      registry.clear();
      events.clear();
    },
  };
}
