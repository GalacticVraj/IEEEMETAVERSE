/**
 * Deterministic pseudo-random number generator contract.
 *
 * The simulation NEVER calls `Math.random()`. All randomness flows through a
 * seeded `Rng` so that a given seed reproduces an identical stream — the
 * backbone of replay verification, snapshots, and deterministic tests.
 *
 * The concrete implementation (xoroshiro128+ seeded via SplitMix64) lives in
 * `@kernel/rng`.
 */

/**
 * Serializable RNG state, used by snapshots and save/restore. The 128-bit
 * xoroshiro state is two 64-bit words encoded as decimal strings (BigInt does
 * not survive `JSON.stringify`).
 */
export interface RngState {
  readonly s0: string;
  readonly s1: string;
}

export interface Rng {
  /** The seed this stream was created from. */
  readonly seed: number;

  /** Next float in the half-open interval [0, 1). */
  next(): number;

  /** Next float in [min, max) (defaults to [0, 1)). */
  randomFloat(min?: number, max?: number): number;

  /** Next integer in [minInclusive, maxExclusive). */
  randomInt(minInclusive: number, maxExclusive: number): number;

  /** True with the given probability (clamped to [0, 1]; defaults to 0.5). */
  randomBoolean(probability?: number): boolean;

  /** A normally-distributed sample (Box–Muller). Defaults to mean 0, stddev 1. */
  randomNormal(mean?: number, stddev?: number): number;

  /** A deterministic Fisher–Yates shuffle returning a NEW array. */
  shuffle<T>(array: readonly T[]): T[];

  /** Uniformly pick one element. Throws on an empty array. */
  pick<T>(array: readonly T[]): T;

  /** Pick one element with probability proportional to its weight. */
  weightedPick<T>(items: readonly T[], weights: readonly number[]): T;

  /** Derive an independent child stream (deterministic given parent state). */
  fork(): Rng;

  /** An exact copy at the current state (advancing one does not affect the other). */
  clone(): Rng;

  /** Capture the current internal state for snapshotting. */
  getState(): RngState;

  /** Restore a previously captured state. */
  setState(state: RngState): void;
}
