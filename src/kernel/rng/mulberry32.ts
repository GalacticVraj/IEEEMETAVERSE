/* eslint-disable @typescript-eslint/no-magic-numbers -- canonical mulberry32 constants */
import type { Rng } from '@core';
import { clamp } from '@utils';

const UINT32 = 0x1_0000_0000; // 2^32

/**
 * mulberry32 — a small, fast, well-distributed 32-bit PRNG. Deterministic for a
 * given seed, which is exactly what the simulation requires: identical seed ⇒
 * identical stream ⇒ reproducible runs and verifiable replays.
 *
 * This is the ONLY source of randomness in the simulation. `Math.random()` is
 * banned in the engine layers.
 */
export function createMulberry32(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32;
  };

  const rng: Rng = {
    seed,
    next,
    nextInt: (minInclusive, maxExclusive) =>
      minInclusive + Math.floor(next() * (maxExclusive - minInclusive)),
    nextRange: (min, max) => min + next() * (max - min),
    chance: (p) => next() < clamp(p, 0, 1),
    fork: () => createMulberry32(Math.floor(next() * UINT32) >>> 0),
  };

  return rng;
}
