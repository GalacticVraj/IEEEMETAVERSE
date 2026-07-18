import type { SystemId } from '@app-types';
import { GridGuardError } from '@core';
import type { SimulationSystem } from '@core';

/**
 * Insertion-ordered registry of simulation systems. The kernel steps systems in
 * registration order every tick, so registration order IS execution order
 * (e.g. weather → generation → load → power flow → protection → cascade).
 *
 * The registry knows nothing about what a system does — it only holds the
 * `SimulationSystem` contract, keeping the kernel open for extension.
 */
export interface SystemRegistry {
  register(system: SimulationSystem): void;
  get(id: SystemId): SimulationSystem | undefined;
  has(id: SystemId): boolean;
  /** All systems, in registration (execution) order. */
  all(): readonly SimulationSystem[];
  clear(): void;
}

export function createSystemRegistry(): SystemRegistry {
  const systems = new Map<SystemId, SimulationSystem>();

  return {
    register(system: SimulationSystem): void {
      if (systems.has(system.id)) {
        throw new GridGuardError(`System already registered: ${system.id}`);
      }
      systems.set(system.id, system);
    },
    get: (id) => systems.get(id),
    has: (id) => systems.has(id),
    all: () => [...systems.values()],
    clear: () => {
      systems.clear();
    },
  };
}
