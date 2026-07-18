import { KernelState } from '@app-types';
import type { Seconds } from '@app-types';
import { DEFAULT_TIMESTEP, MAX_EVENT_LISTENERS } from '@constants';
import { GridGuardError, KERNEL_EVENT, NoopLogger, createEventBus } from '@core';
import type {
  Clock,
  KernelEventMap,
  Logger,
  Rng,
  RngState,
  SimulationSystem,
  SystemContext,
  TickContext,
  TypedEventBus,
} from '@core';

import { createDiagnostics } from './diagnostics/diagnostics';
import type { Diagnostics } from './diagnostics/diagnostics';
import { createKernelLifecycle } from './fsm/kernel-lifecycle';
import type { KernelLifecycle } from './fsm/kernel-lifecycle';
import { createLifecycleManager } from './lifecycle/lifecycle-manager';
import { createSystemRegistry } from './registry/system-registry';
import type { SystemRegistry } from './registry/system-registry';
import { createXoroshiro128Plus } from './rng/xoroshiro128plus';
import { createScheduler } from './scheduler/scheduler';
import { createTaskScheduler } from './scheduler/task-scheduler';
import type { TaskScheduler } from './scheduler/task-scheduler';
import { captureKernelSnapshot, hashSnapshot, restoreKernelSnapshot } from './snapshot/snapshot';
import type { KernelSnapshot } from './snapshot/snapshot';
import { createClockFromFrequency, createSimClock } from './time/sim-clock';

export interface SimulationKernelOptions<TEvents extends KernelEventMap = KernelEventMap> {
  /** Seed that makes the entire run reproducible. */
  readonly seed: number;
  /** Simulation frequency in Hz (e.g. 5, 10, 20, 30, 60). Overrides timestep. */
  readonly frequencyHz?: number;
  /** Explicit fixed timestep; defaults to {@link DEFAULT_TIMESTEP}. */
  readonly timestep?: Seconds;
  /** Inject a shared bus; otherwise the kernel creates a tick-aware one. */
  readonly events?: TypedEventBus<TEvents>;
  /** Inject a logger; defaults to {@link NoopLogger}. */
  readonly logger?: Logger;
  /** Injected monotonic wall-clock (ms) for diagnostics. Defaults to 0. */
  readonly timeProvider?: () => number;
  /** Freeze event payloads for immutability (used in competition mode). */
  readonly freezePayloads?: boolean;
  /** Warn when an event's listener count exceeds this. */
  readonly leakThreshold?: number;
}

/**
 * The Simulation Kernel: the deterministic engine core. It owns time (clock),
 * randomness (rng), the runtime lifecycle (KernelLifecycle), the system
 * registry, the tick and task schedulers, diagnostics, and the event bus, and
 * it exposes the tick loop and snapshot API. It is DOMAIN-AGNOSTIC — it knows
 * nothing about power flow, cascades, or gameplay, only how to drive registered
 * systems, and it emits only kernel events (SimulationTick, KernelStateChanged).
 *
 * Determinism guarantee: identical seed, systems, and tick/transition sequence
 * ⇒ identical emitted event stream, snapshots, and hashes.
 */
export interface SimulationKernel<TEvents extends KernelEventMap = KernelEventMap> {
  readonly events: TypedEventBus<TEvents>;
  readonly clock: Clock;
  readonly rng: Rng;
  readonly lifecycle: KernelLifecycle;
  readonly registry: SystemRegistry<TEvents>;
  /** Deterministic timed/repeating task scheduler. */
  readonly scheduler: TaskScheduler;
  readonly diagnostics: Diagnostics;
  readonly state: KernelState;

  /** Register a system (only before `boot`). */
  register(system: SimulationSystem<TEvents>): void;

  /** Boot → Loading → Configuration → RegisterSystems → Calibration → Idle. */
  boot(): void;
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  enterReplay(): void;
  exitReplay(): void;
  shutdown(): void;
  dispose(): void;

  /** Advance one fixed timestep (only while Running or Replay). */
  tick(): void;
  /** Advance `count` ticks. */
  run(count: number): void;

  /** Low-level validated lifecycle transition. */
  transition(target: KernelState): void;

  snapshot(): KernelSnapshot;
  restore(snapshot: KernelSnapshot): void;
  /** Deterministic hash of the current authoritative state. */
  hash(): string;

  /** Return clock, rng, and systems to their initial state (keeps lifecycle). */
  reset(): void;
}

export function createSimulationKernel<TEvents extends KernelEventMap = KernelEventMap>(
  options: SimulationKernelOptions<TEvents>,
): SimulationKernel<TEvents> {
  const clock: Clock =
    options.frequencyHz !== undefined
      ? createClockFromFrequency(options.frequencyHz)
      : createSimClock(options.timestep ?? DEFAULT_TIMESTEP);

  const rng = createXoroshiro128Plus(options.seed);
  const initialRngState: RngState = rng.getState();

  const timeProvider = options.timeProvider ?? (() => 0);
  const logger = (options.logger ?? NoopLogger).child('kernel');
  const events: TypedEventBus<TEvents> =
    options.events ??
    createEventBus<TEvents>({
      tickProvider: () => clock.tick,
      timeProvider,
      freezePayloads: options.freezePayloads ?? false,
      leakThreshold: options.leakThreshold ?? MAX_EVENT_LISTENERS,
      onLeak: (event, count) => {
        logger.warn('Event listener leak', { event: String(event), count });
      },
    });
  const lifecycle = createKernelLifecycle();
  const registry = createSystemRegistry<TEvents>();
  const systemRunner = createScheduler<TEvents>();
  const scheduler = createTaskScheduler(clock);
  const lifecycleManager = createLifecycleManager<TEvents>();
  const diagnostics = createDiagnostics(timeProvider);

  const context: SystemContext<TEvents> = { events, rng, clock, logger };
  let orderedSystems: readonly SimulationSystem<TEvents>[] = [];

  // Bridge validated lifecycle changes onto the event bus.
  lifecycle.onChange(({ from, to }) => {
    events.emit(KERNEL_EVENT.KernelStateChanged, { from, to, tick: clock.tick });
  });

  const requireRunning = (): void => {
    if (lifecycle.state !== KernelState.Running && lifecycle.state !== KernelState.Replay) {
      throw new GridGuardError(
        `Cannot tick while in state "${lifecycle.state}" (must be Running or Replay)`,
      );
    }
  };

  const doTick = (): void => {
    requireRunning();
    diagnostics.beginTick();
    clock.advance();
    const tickContext: TickContext = {
      tick: clock.tick,
      time: clock.time,
      timestep: clock.timestep,
    };
    for (const system of orderedSystems) {
      diagnostics.beginSystem(String(system.id));
      systemRunner.step([system], tickContext);
      diagnostics.endSystem(String(system.id));
    }
    scheduler.runDue();
    events.emit(KERNEL_EVENT.SimulationTick, {
      tick: clock.tick,
      simTime: clock.time,
      timestep: clock.timestep,
    });
    diagnostics.endTick();
  };

  const kernel: SimulationKernel<TEvents> = {
    events,
    clock,
    rng,
    lifecycle,
    registry,
    scheduler,
    diagnostics,

    get state(): KernelState {
      return lifecycle.state;
    },

    register(system: SimulationSystem<TEvents>): void {
      if (lifecycle.state !== KernelState.Boot) {
        throw new GridGuardError(
          `Systems must be registered before boot (current state "${lifecycle.state}")`,
        );
      }
      registry.register(system);
    },

    boot(): void {
      lifecycle.transition(KernelState.Loading);
      lifecycle.transition(KernelState.Configuration);
      lifecycle.transition(KernelState.RegisterSystems);
      orderedSystems = registry.resolveOrder();
      lifecycle.transition(KernelState.Calibration);
      lifecycleManager.init(orderedSystems, context);
      lifecycle.transition(KernelState.Idle);
      logger.info('Kernel booted', { systems: orderedSystems.length });
    },

    start(): void {
      lifecycle.transition(KernelState.Running);
    },
    pause(): void {
      lifecycle.transition(KernelState.Paused);
    },
    resume(): void {
      lifecycle.transition(KernelState.Running);
    },
    stop(): void {
      lifecycle.transition(KernelState.Idle);
    },
    enterReplay(): void {
      lifecycle.transition(KernelState.Replay);
    },
    exitReplay(): void {
      lifecycle.transition(KernelState.Idle);
    },
    shutdown(): void {
      lifecycle.transition(KernelState.Shutdown);
    },
    dispose(): void {
      lifecycle.transition(KernelState.Disposed);
      lifecycleManager.dispose(orderedSystems);
      scheduler.clear();
      registry.clear();
      events.clear();
    },

    tick: doTick,

    run(count: number): void {
      for (let i = 0; i < count; i += 1) {
        doTick();
      }
    },

    transition(target: KernelState): void {
      lifecycle.transition(target);
    },

    snapshot(): KernelSnapshot {
      return captureKernelSnapshot(clock, rng, orderedSystems);
    },
    restore(snapshot: KernelSnapshot): void {
      restoreKernelSnapshot(snapshot, clock, rng, orderedSystems);
    },
    hash(): string {
      return hashSnapshot(captureKernelSnapshot(clock, rng, orderedSystems));
    },

    reset(): void {
      lifecycleManager.reset(orderedSystems);
      clock.reset();
      rng.setState(initialRngState);
      scheduler.clear();
      diagnostics.reset();
    },
  };

  return kernel;
}
