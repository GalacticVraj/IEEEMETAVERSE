import type { SimulationSystem, SystemContext } from '@core';

/**
 * Drives the coarse lifecycle transitions across all registered systems:
 * one-time `init`, `reset` (return to initial state), and `dispose` (release
 * resources). Per-tick advancement is the scheduler's job, not this manager's.
 */
export interface LifecycleManager {
  init(systems: readonly SimulationSystem[], context: SystemContext): void;
  reset(systems: readonly SimulationSystem[]): void;
  dispose(systems: readonly SimulationSystem[]): void;
}

export function createLifecycleManager(): LifecycleManager {
  return {
    init(systems: readonly SimulationSystem[], context: SystemContext): void {
      for (const system of systems) {
        system.init(context);
      }
    },
    reset(systems: readonly SimulationSystem[]): void {
      for (const system of systems) {
        system.reset();
      }
    },
    dispose(systems: readonly SimulationSystem[]): void {
      for (const system of systems) {
        system.dispose();
      }
    },
  };
}
