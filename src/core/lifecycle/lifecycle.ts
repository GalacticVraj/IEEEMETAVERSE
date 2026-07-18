import type { Seconds, SystemId } from '@app-types';

import type { Clock } from '@core/clock/clock';
import type { GridEventBus } from '@core/events/grid-events';
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
 */
export interface SystemContext {
  readonly events: GridEventBus;
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
export interface SimulationSystem extends Disposable {
  /** Stable identity used by the system registry and scheduler ordering. */
  readonly id: SystemId;
  /** One-time setup; capture the context, allocate state. */
  init(context: SystemContext): void;
  /** Advance this system by exactly one fixed timestep. */
  step(context: TickContext): void;
  /** Return to initial state without tearing down (used by Reset). */
  reset(): void;
}
