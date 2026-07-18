import type { KernelEventMap, SimulationSystem, TickContext } from '@core';

/**
 * Advances a set of systems by one tick, in order. Stateless by design — the
 * kernel supplies the ordered system list and the per-tick context, so the
 * scheduler has no hidden state to desynchronize from the clock. (For timed and
 * repeating callbacks, see the separate {@link TaskScheduler}.)
 */
export interface Scheduler<TEvents extends KernelEventMap = KernelEventMap> {
  step(systems: readonly SimulationSystem<TEvents>[], context: TickContext): void;
}

export function createScheduler<
  TEvents extends KernelEventMap = KernelEventMap,
>(): Scheduler<TEvents> {
  return {
    step(systems: readonly SimulationSystem<TEvents>[], context: TickContext): void {
      for (const system of systems) {
        system.step(context);
      }
    },
  };
}
