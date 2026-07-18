/* eslint-disable @typescript-eslint/no-magic-numbers -- xoroshiro128+/SplitMix64 reference constants */
import { GridGuardError } from '@core';
import type { Rng, RngState } from '@core';
import { clamp } from '@utils';

const MASK64 = (1n << 64n) - 1n;
const TWO53 = 9_007_199_254_740_992; // 2^53
const CHILD_SEED_MASK = 0x1f_ffff_ffff_ffffn; // 53 bits → JS-number-safe

const rotl = (value: bigint, shift: bigint): bigint =>
  ((value << shift) | (value >> (64n - shift))) & MASK64;

/** SplitMix64 — expands a single seed into well-distributed 64-bit words. */
const splitmix64 = (seed: bigint): (() => bigint) => {
  let state = seed & MASK64;
  return () => {
    state = (state + 0x9e37_79b9_7f4a_7c15n) & MASK64;
    let z = state;
    z = ((z ^ (z >> 30n)) * 0xbf58_476d_1ce4_e5b9n) & MASK64;
    z = ((z ^ (z >> 27n)) * 0x94d0_49bb_1331_11ebn) & MASK64;
    return z ^ (z >> 31n);
  };
};

/**
 * xoroshiro128+ (Blackman & Vigna, v1.0) — a fast, high-quality 64-bit PRNG,
 * seeded via SplitMix64. Deterministic and fully serializable, so a run is
 * reproducible from its seed and a snapshot can restore the exact stream.
 *
 * This is GridGuard's canonical randomness source. `Math.random()` is banned.
 */
export function createXoroshiro128Plus(seed: number): Rng {
  let s0 = 0n;
  let s1 = 0n;

  const seedFrom = (rawSeed: number): void => {
    const mix = splitmix64(BigInt(Math.trunc(rawSeed)) & MASK64);
    s0 = mix();
    s1 = mix();
    if (s0 === 0n && s1 === 0n) {
      s0 = 1n; // the all-zero state is a fixed point; avoid it
    }
  };
  seedFrom(seed);

  const next64 = (): bigint => {
    const a = s0;
    let b = s1;
    const result = (a + b) & MASK64;
    b ^= a;
    s0 = (rotl(a, 24n) ^ b ^ ((b << 16n) & MASK64)) & MASK64;
    s1 = rotl(b, 37n);
    return result;
  };

  const next = (): number => Number(next64() >> 11n) / TWO53;

  const randomFloat = (min = 0, max = 1): number => min + next() * (max - min);

  const randomInt = (minInclusive: number, maxExclusive: number): number =>
    minInclusive + Math.floor(next() * (maxExclusive - minInclusive));

  const randomBoolean = (probability = 0.5): boolean => next() < clamp(probability, 0, 1);

  const randomNormal = (mean = 0, stddev = 1): number => {
    // Box–Muller. We keep no hidden "spare" so the entire generator state lives
    // in (s0, s1) and is fully captured by getState() — snapshot-safe.
    let u = 0;
    let v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    const magnitude = Math.sqrt(-2 * Math.log(u));
    return mean + stddev * (magnitude * Math.cos(2 * Math.PI * v));
  };

  const shuffle = <T>(array: readonly T[]): T[] => {
    const out = [...array];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = randomInt(0, i + 1);
      const atI = out[i] as T;
      out[i] = out[j] as T;
      out[j] = atI;
    }
    return out;
  };

  const pick = <T>(array: readonly T[]): T => {
    if (array.length === 0) {
      throw new GridGuardError('Rng.pick() called on an empty array');
    }
    return array[randomInt(0, array.length)] as T;
  };

  const weightedPick = <T>(items: readonly T[], weights: readonly number[]): T => {
    if (items.length === 0) {
      throw new GridGuardError('Rng.weightedPick() called on empty items');
    }
    if (items.length !== weights.length) {
      throw new GridGuardError('Rng.weightedPick(): items and weights length mismatch');
    }
    const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
    if (total <= 0) {
      throw new GridGuardError('Rng.weightedPick() requires a positive total weight');
    }
    let threshold = next() * total;
    for (let i = 0; i < items.length; i += 1) {
      threshold -= Math.max(0, weights[i] as number);
      if (threshold < 0) {
        return items[i] as T;
      }
    }
    return items[items.length - 1] as T;
  };

  const rng: Rng = {
    seed,
    next,
    randomFloat,
    randomInt,
    randomBoolean,
    randomNormal,
    shuffle,
    pick,
    weightedPick,
    fork: () => createXoroshiro128Plus(Number(next64() & CHILD_SEED_MASK)),
    clone: () => {
      const copy = createXoroshiro128Plus(seed);
      copy.setState({ s0: s0.toString(), s1: s1.toString() });
      return copy;
    },
    getState: (): RngState => ({ s0: s0.toString(), s1: s1.toString() }),
    setState: (state: RngState): void => {
      s0 = BigInt(state.s0) & MASK64;
      s1 = BigInt(state.s1) & MASK64;
    },
  };
  return rng;
}
