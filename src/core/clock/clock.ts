import type { Seconds } from '@app-types';

/** Serializable clock position, used by snapshots and save/restore. */
export interface ClockState {
  readonly tick: number;
  /** Elapsed simulated seconds. */
  readonly elapsed: number;
}

/**
 * Virtual simulation clock. Time is DECOUPLED from wall-clock time: the clock
 * advances by a fixed timestep only when `advance()` is called by the kernel.
 * This is what makes the simulation deterministic and replayable — identical
 * tick counts always correspond to identical simulated time.
 *
 * The concrete implementation lives in `@kernel/time`.
 */
export interface Clock {
  /** Number of completed ticks since the last reset. */
  readonly tick: number;
  /** Total elapsed simulated time. */
  readonly time: Seconds;
  /** Fixed step by which `advance()` moves time forward. */
  readonly timestep: Seconds;
  /** Simulation frequency in Hz (1 / timestep). */
  readonly frequencyHz: number;
  /** Advance by exactly one fixed timestep. */
  advance(): void;
  /** Reset tick and time to zero. */
  reset(): void;
  /** Capture the current position for snapshotting. */
  getState(): ClockState;
  /** Restore a previously captured position. */
  setState(state: ClockState): void;
}
