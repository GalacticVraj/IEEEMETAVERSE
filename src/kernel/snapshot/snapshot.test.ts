import { asSystemId } from '@app-types';
import type { SimulationSystem, SnapshotableSystem } from '@core';
import { describe, expect, it } from 'vitest';

import { createXoroshiro128Plus } from '../rng/xoroshiro128plus';
import { asSeconds } from '@app-types';
import { createSimClock } from '../time/sim-clock';
import {
  canonicalize,
  captureKernelSnapshot,
  compareSnapshots,
  hashSnapshot,
  restoreKernelSnapshot,
} from './snapshot';

describe('canonicalize', () => {
  it('is independent of object key order', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
  });

  it('distinguishes different values', () => {
    expect(canonicalize({ a: 1 })).not.toBe(canonicalize({ a: 2 }));
  });
});

describe('hashSnapshot', () => {
  it('is deterministic and collision-sensitive', () => {
    const clock = createSimClock(asSeconds(0.1));
    const rng = createXoroshiro128Plus(1);
    const snapA = captureKernelSnapshot(clock, rng, []);
    const snapB = captureKernelSnapshot(
      createSimClock(asSeconds(0.1)),
      createXoroshiro128Plus(1),
      [],
    );
    expect(hashSnapshot(snapA)).toBe(hashSnapshot(snapB));

    rng.next();
    const snapC = captureKernelSnapshot(clock, rng, []);
    expect(hashSnapshot(snapC)).not.toBe(hashSnapshot(snapA));
  });
});

describe('compareSnapshots', () => {
  it('reports equality and inequality via hashes', () => {
    const clock = createSimClock(asSeconds(0.1));
    const a = captureKernelSnapshot(clock, createXoroshiro128Plus(1), []);
    const b = captureKernelSnapshot(clock, createXoroshiro128Plus(1), []);
    expect(compareSnapshots(a, b).equal).toBe(true);

    const c = captureKernelSnapshot(clock, createXoroshiro128Plus(2), []);
    expect(compareSnapshots(a, c).equal).toBe(false);
  });
});

describe('capture / restore', () => {
  it('round-trips clock, rng, and system state exactly', () => {
    const clock = createSimClock(asSeconds(0.1));
    const rng = createXoroshiro128Plus(1);
    let count = 0;
    const system: SimulationSystem & SnapshotableSystem = {
      id: asSystemId('s'),
      init: () => undefined,
      step: () => undefined,
      reset: () => undefined,
      dispose: () => undefined,
      captureState: () => ({ count }),
      restoreState: (state) => {
        count = (state as { count: number }).count;
      },
    };

    clock.advance();
    clock.advance();
    clock.advance();
    rng.next();
    rng.next();
    count = 5;

    const snapshot = captureKernelSnapshot(clock, rng, [system]);

    // Diverge everything.
    clock.advance();
    clock.advance();
    rng.next();
    rng.next();
    rng.next();
    count = 99;

    restoreKernelSnapshot(snapshot, clock, rng, [system]);

    expect(clock.tick).toBe(3);
    expect(count).toBe(5);

    // The rng stream after restore must match a fresh rng advanced two draws.
    const reference = createXoroshiro128Plus(1);
    reference.next();
    reference.next();
    expect(rng.next()).toBe(reference.next());
  });
});
