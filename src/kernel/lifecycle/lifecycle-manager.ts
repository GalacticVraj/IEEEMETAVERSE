import type { KernelEventMap, SimulationSystem, SystemContext } from '@core';

/**
 * Drives the coarse lifecycle transitions across all registered systems:
 * one-time `init`, `reset` (return to initial state), and `dispose` (release
 * resources). Per-tick advancement is the scheduler's job, not this manager's.
 */
export interface LifecycleManager<TEvents extends KernelEventMap = KernelEventMap> {
  init(systems: readonly SimulationSystem<TEvents>[], context: SystemContext<TEvents>): void;
  reset(systems: readonly SimulationSystem<TEvents>[]): void;
  dispose(systems: readonly SimulationSystem<TEvents>[]): void;
}

export function createLifecycleManager<
  TEvents extends KernelEventMap = KernelEventMap,
>(): LifecycleManager<TEvents> {
  return {
    init(systems: readonly SimulationSystem<TEvents>[], context: SystemContext<TEvents>): void {
      for (const system of systems) {
        system.init(context);
      }
    },
    reset(systems: readonly SimulationSystem<TEvents>[]): void {
      for (const system of systems) {
        system.reset();
      }
    },
    dispose(systems: readonly SimulationSystem<TEvents>[]): void {
      for (const system of systems) {
        system.dispose();
      }
    },
  };
}
