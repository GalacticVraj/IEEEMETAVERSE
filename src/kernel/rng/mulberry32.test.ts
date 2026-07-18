import { describe, expect, it } from 'vitest';

import { createMulberry32 } from './mulberry32';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = createMulberry32(42);
    const b = createMulberry32(42);
    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces values in [0, 1)', () => {
    const rng = createMulberry32(1);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('nextInt stays within [min, max) and returns integers', () => {
    const rng = createMulberry32(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.nextInt(3, 9);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThan(9);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('different seeds diverge', () => {
    const a = createMulberry32(1);
    const b = createMulberry32(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('fork is deterministic given identical parent state', () => {
    const childA = createMulberry32(99).fork();
    const childB = createMulberry32(99).fork();
    expect(childA.next()).toBe(childB.next());
  });
});
