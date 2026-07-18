import { KernelState, asSystemId } from '@app-types';
import { KERNEL_EVENT } from '@core';
import type { Rng, SimulationSystem, SnapshotableSystem } from '@core';
import { describe, expect, it, vi } from 'vitest';

import { createSimulationKernel } from './simulation-kernel';

/** A system that draws from the rng each tick and carries snapshotable state. */
const makeDrawingSystem = (id: string): SimulationSystem & SnapshotableSystem => {
  let rng: Rng | null = null;
  let sum = 0;
  return {
    id: asSystemId(id),
    init: (context) => {
      rng = context.rng;
    },
    step: () => {
      if (rng !== null) sum += rng.next();
    },
    reset: () => {
      sum = 0;
    },
    dispose: () => undefined,
    captureState: () => ({ sum }),
    restoreState: (state) => {
      sum = (state as { sum: number }).sum;
    },
  };
};

describe('SimulationKernel', () => {
  it('starts in Boot', () => {
    expect(createSimulationKernel({ seed: 1 }).state).toBe(KernelState.Boot);
  });

  it('boots to Idle and initializes systems', () => {
    const kernel = createSimulationKernel({ seed: 1 });
    const init = vi.fn();
    kernel.register({
      id: asSystemId('s'),
      init,
      step: () => undefined,
      reset: () => undefined,
      dispose: () => undefined,
    });
    kernel.boot();
    expect(kernel.state).toBe(KernelState.Idle);
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('emits KernelStateChanged during boot', () => {
    const kernel = createSimulationKernel({ seed: 1 });
    const changed = vi.fn();
    kernel.events.on(KERNEL_EVENT.KernelStateChanged, changed);
    kernel.boot();
    expect(changed).toHaveBeenCalled();
  });

  it('ticks only while running, advancing the clock and emitting SimulationTick', () => {
    const kernel = createSimulationKernel({ seed: 1 });
    const ticked = vi.fn();
    kernel.events.on(KERNEL_EVENT.SimulationTick, ticked);
    kernel.boot();
    expect(() => kernel.tick()).toThrow(); // not running yet
    kernel.start();
    kernel.tick();
    expect(kernel.clock.tick).toBe(1);
    expect(ticked).toHaveBeenCalledTimes(1);
  });

  it('rejects registering a system after boot', () => {
    const kernel = createSimulationKernel({ seed: 1 });
    kernel.boot();
    expect(() => {
      kernel.register(makeDrawingSystem('late'));
    }).toThrow();
  });

  it('steps systems every tick in dependency order', () => {
    const kernel = createSimulationKernel({ seed: 1 });
    const order: string[] = [];
    kernel.register({
      id: asSystemId('b'),
      dependencies: [asSystemId('a')],
      init: () => undefined,
      step: () => order.push('b'),
      reset: () => undefined,
      dispose: () => undefined,
    });
    kernel.register({
      id: asSystemId('a'),
      init: () => undefined,
      step: () => order.push('a'),
      reset: () => undefined,
      dispose: () => undefined,
    });
    kernel.boot();
    kernel.start();
    kernel.tick();
    expect(order).toEqual(['a', 'b']);
  });

  it('is deterministic: identical seeds and ticks produce identical hashes', () => {
    const build = (seed: number): string => {
      const kernel = createSimulationKernel({ seed });
      kernel.register(makeDrawingSystem('a'));
      kernel.boot();
      kernel.start();
      kernel.run(5);
      return kernel.hash();
    };
    expect(build(7)).toBe(build(7));
    expect(build(7)).not.toBe(build(8));
  });

  it('snapshots and restores to an identical state hash', () => {
    const kernel = createSimulationKernel({ seed: 3 });
    kernel.register(makeDrawingSystem('a'));
    kernel.boot();
    kernel.start();
    kernel.run(3);
    const snapshot = kernel.snapshot();
    const hashAt3 = kernel.hash();

    kernel.run(3);
    expect(kernel.hash()).not.toBe(hashAt3);

    kernel.restore(snapshot);
    expect(kernel.hash()).toBe(hashAt3);
  });

  it('drives scheduled tasks during ticks', () => {
    const kernel = createSimulationKernel({ seed: 1 });
    kernel.boot();
    kernel.start();
    const fired: number[] = [];
    kernel.scheduler.atTick(2, () => fired.push(kernel.clock.tick));
    kernel.run(4);
    expect(fired).toEqual([2]);
  });

  it('walks pause/resume/stop and disposes cleanly', () => {
    const kernel = createSimulationKernel({ seed: 1 });
    kernel.boot();
    kernel.start();
    kernel.pause();
    expect(kernel.state).toBe(KernelState.Paused);
    kernel.resume();
    expect(kernel.state).toBe(KernelState.Running);
    kernel.stop();
    expect(kernel.state).toBe(KernelState.Idle);
    kernel.shutdown();
    kernel.dispose();
    expect(kernel.state).toBe(KernelState.Disposed);
  });
});
