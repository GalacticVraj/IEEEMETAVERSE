import { describe, expect, it } from 'vitest';

import { createXoroshiro128Plus } from './xoroshiro128plus';

describe('xoroshiro128+', () => {
  it('is deterministic for a given seed', () => {
    const a = createXoroshiro128Plus(42);
    const b = createXoroshiro128Plus(42);
    const seqA = Array.from({ length: 16 }, () => a.next());
    const seqB = Array.from({ length: 16 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds diverge', () => {
    const a = createXoroshiro128Plus(1);
    const b = createXoroshiro128Plus(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('next() stays in [0, 1)', () => {
    const rng = createXoroshiro128Plus(7);
    for (let i = 0; i < 5000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('randomInt stays within [min, max) and returns integers', () => {
    const rng = createXoroshiro128Plus(9);
    for (let i = 0; i < 5000; i += 1) {
      const value = rng.randomInt(3, 9);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThan(9);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('randomFloat honors bounds and defaults to [0, 1)', () => {
    const rng = createXoroshiro128Plus(11);
    expect(rng.randomFloat()).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.randomFloat(10, 20);
      expect(value).toBeGreaterThanOrEqual(10);
      expect(value).toBeLessThan(20);
    }
  });

  it('randomBoolean is deterministic at the extremes', () => {
    const rng = createXoroshiro128Plus(3);
    expect(rng.randomBoolean(0)).toBe(false);
    expect(rng.randomBoolean(1)).toBe(true);
  });

  it('randomNormal is deterministic for a seed', () => {
    const a = createXoroshiro128Plus(5);
    const b = createXoroshiro128Plus(5);
    const seqA = Array.from({ length: 8 }, () => a.randomNormal(10, 2));
    const seqB = Array.from({ length: 8 }, () => b.randomNormal(10, 2));
    expect(seqA).toEqual(seqB);
  });

  it('shuffle returns a deterministic permutation without mutating input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = createXoroshiro128Plus(13).shuffle(input);
    const b = createXoroshiro128Plus(13).shuffle(input);
    expect(a).toEqual(b);
    expect(a).not.toBe(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...a].sort((x, y) => x - y)).toEqual(input);
  });

  it('pick returns an element and throws on empty', () => {
    const rng = createXoroshiro128Plus(21);
    const arr = ['a', 'b', 'c'];
    expect(arr).toContain(rng.pick(arr));
    expect(() => rng.pick([])).toThrow();
  });

  it('weightedPick respects zero weights', () => {
    const rng = createXoroshiro128Plus(21);
    for (let i = 0; i < 100; i += 1) {
      expect(rng.weightedPick(['x', 'y', 'z'], [1, 0, 0])).toBe('x');
    }
  });

  it('clone reproduces the same forward sequence, independently', () => {
    const rng = createXoroshiro128Plus(99);
    rng.next();
    const clone = rng.clone();
    const original = Array.from({ length: 5 }, () => rng.next());
    const copied = Array.from({ length: 5 }, () => clone.next());
    expect(copied).toEqual(original);
  });

  it('fork is deterministic and independent from the parent stream', () => {
    const childA = createXoroshiro128Plus(77).fork();
    const childB = createXoroshiro128Plus(77).fork();
    expect(childA.next()).toBe(childB.next());
  });

  it('getState/setState round-trips exactly', () => {
    const rng = createXoroshiro128Plus(55);
    rng.next();
    rng.next();
    const state = rng.getState();
    const expected = Array.from({ length: 5 }, () => rng.next());

    const restored = createXoroshiro128Plus(1);
    restored.setState(state);
    const actual = Array.from({ length: 5 }, () => restored.next());
    expect(actual).toEqual(expected);
  });
});
