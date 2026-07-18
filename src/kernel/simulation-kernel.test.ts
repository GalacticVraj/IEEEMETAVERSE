import { SimulationState, asSystemId } from '@app-types';
import { GRID_EVENT } from '@constants';
import type { SimulationSystem, TickContext } from '@core';
import { describe, expect, it, vi } from 'vitest';

import { createSimulationKernel } from './simulation-kernel';

const makeSystem = (id: string, onStep?: (context: TickContext) => void): SimulationSystem => ({
  id: asSystemId(id),
  init: () => undefined,
  step: (context) => {
    onStep?.(context);
  },
  reset: () => undefined,
  dispose: () => undefined,
});

describe('SimulationKernel', () => {
  it('advances the clock and emits SimulationTick on tick', () => {
    const kernel = createSimulationKernel({ seed: 1 });
    const handler = vi.fn();
    kernel.events.on(GRID_EVENT.SimulationTick, handler);
    kernel.boot();
    kernel.tick();
    expect(kernel.clock.tick).toBe(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('steps registered systems every tick', () => {
    const kernel = createSimulationKernel({ seed: 1 });
    const step = vi.fn();
    kernel.register(makeSystem('a', step));
    kernel.boot();
    kernel.tick();
    kernel.tick();
    expect(step).toHaveBeenCalledTimes(2);
  });

  it('bridges FSM changes onto SimStateChanged', () => {
    const kernel = createSimulationKernel({ seed: 1 });
    const handler = vi.fn();
    kernel.events.on(GRID_EVENT.SimStateChanged, handler);
    kernel.transition(SimulationState.Loading);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ from: SimulationState.Boot, to: SimulationState.Loading }),
    );
  });

  it('is deterministic: identical seeds produce identical rng streams', () => {
    const a = createSimulationKernel({ seed: 123 });
    const b = createSimulationKernel({ seed: 123 });
    expect(a.rng.next()).toBe(b.rng.next());
  });

  it('disposes cleanly with no registered systems', () => {
    const kernel = createSimulationKernel({ seed: 1 });
    expect(() => {
      kernel.dispose();
    }).not.toThrow();
  });
});
