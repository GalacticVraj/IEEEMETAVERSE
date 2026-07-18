import type { Seconds, SystemId } from '@app-types';

import type { Clock } from '@core/clock/clock';
import type { TypedEventBus } from '@core/events/event-bus';
import type { KernelEventMap } from '@core/events/kernel-events';
import type { Logger } from '@core/logging/logger';
import type { Rng } from '@core/rng/rng';

/** Anything holding resources that must be released. */
export interface Disposable {
  dispose(): void;
}

/**
 * Read-only services handed to every simulation system when it initializes.
 * A system emits through `events`, draws randomness from `rng`, reads time
 * from `clock`, and logs through `logger` — and receives nothing else.
 *
 * Generic over the event map so the kernel can drive systems without knowing
 * any specific domain: it defaults to the domain-agnostic `KernelEventMap`; a
 * domain (e.g. the electrical grid) instantiates it with its own richer map.
 */
export interface SystemContext<TEvents extends KernelEventMap = KernelEventMap> {
  readonly events: TypedEventBus<TEvents>;
  readonly rng: Rng;
  readonly clock: Clock;
  readonly logger: Logger;
}

/** Per-tick information passed to `SimulationSystem.step`. */
export interface TickContext {
  readonly tick: number;
  readonly time: Seconds;
  readonly timestep: Seconds;
}

/**
 * A unit of simulation the kernel can register, order, and drive. Systems are
 * the ONLY things advanced by the scheduler each tick. They own their own
 * authoritative state and communicate exclusively via events.
 */
export interface SimulationSystem<
  TEvents extends KernelEventMap = KernelEventMap,
> extends Disposable {
  /** Stable identity used by the system registry and scheduler ordering. */
  readonly id: SystemId;
  /**
   * Ids of systems that must execute BEFORE this one each tick. The registry
   * topologically orders systems by these edges (and rejects cycles). Omit or
   * leave empty for a system with no ordering constraints.
   */
  readonly dependencies?: readonly SystemId[];
  /** One-time setup; capture the context, allocate state. */
  init(context: SystemContext<TEvents>): void;
  /** Advance this system by exactly one fixed timestep. */
  step(context: TickContext): void;
  /** Return to initial state without tearing down (used by Reset). */
  reset(): void;
}

/**
 * Optional capability for systems that hold authoritative state: it lets the
 * kernel snapshot and restore them deterministically. A system that owns no
 * state need not implement this. `captureState`/`restoreState` must round-trip
 * exactly (the captured value is serialized and hashed).
 */
export interface SnapshotableSystem {
  captureState(): unknown;
  restoreState(state: unknown): void;
}

/** True if a system participates in snapshot capture/restore. */
export function isSnapshotable<TEvents extends KernelEventMap = KernelEventMap>(
  system: SimulationSystem<TEvents>,
): system is SimulationSystem<TEvents> & SnapshotableSystem {
  return (
    'captureState' in system &&
    typeof (system as Partial<SnapshotableSystem>).captureState === 'function'
  );
}
