/**
 * Deterministic pseudo-random number generator contract.
 *
 * The simulation NEVER calls `Math.random()`. All randomness flows through a
 * seeded `Rng` so that a given seed reproduces an identical event stream — the
 * backbone of replay verification and deterministic tests.
 *
 * The concrete implementation (mulberry32) lives in `@kernel/rng`.
 */
export interface Rng {
  /** The seed this stream was created from. */
  readonly seed: number;
  /** Next float in the half-open interval [0, 1). */
  next(): number;
  /** Next integer in [minInclusive, maxExclusive). */
  nextInt(minInclusive: number, maxExclusive: number): number;
  /** Next float in [min, max). */
  nextRange(min: number, max: number): number;
  /** True with probability `p` (clamped to [0, 1]). */
  chance(p: number): boolean;
  /** Derive an independent child stream (deterministic given parent state). */
  fork(): Rng;
}
