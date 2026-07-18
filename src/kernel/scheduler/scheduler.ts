import type { SimulationSystem, TickContext } from '@core';

/**
 * Advances a set of systems by one tick, in order. Stateless by design — the
 * kernel supplies the ordered system list and the per-tick context, so the
 * scheduler has no hidden state to desynchronize from the clock.
 */
export interface Scheduler {
  step(systems: readonly SimulationSystem[], context: TickContext): void;
}

export function createScheduler(): Scheduler {
  return {
    step(systems: readonly SimulationSystem[], context: TickContext): void {
      for (const system of systems) {
        system.step(context);
      }
    },
  };
}
