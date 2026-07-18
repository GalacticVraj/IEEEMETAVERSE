import type { Seconds } from '@app-types';

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
  /** Advance by exactly one fixed timestep. */
  advance(): void;
  /** Reset tick and time to zero. */
  reset(): void;
}
