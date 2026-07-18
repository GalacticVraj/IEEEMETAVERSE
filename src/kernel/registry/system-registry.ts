import type { SystemId } from '@app-types';
import { CircularDependencyError, GridGuardError, MissingDependencyError } from '@core';
import type { KernelEventMap, SimulationSystem } from '@core';

/**
 * Insertion-ordered registry of simulation systems with dependency-aware
 * execution ordering. `all()` preserves registration order; `resolveOrder()`
 * returns a deterministic topological order that runs each system after its
 * declared dependencies. Cycles and unknown dependencies are rejected.
 *
 * The registry knows nothing about what a system does — only the
 * `SimulationSystem` contract — so new systems (power flow, cascade, weather,
 * audio, …) are added without modifying the kernel. Generic over the event map
 * so it stays domain-agnostic (defaults to `KernelEventMap`).
 */
export interface SystemRegistry<TEvents extends KernelEventMap = KernelEventMap> {
  register(system: SimulationSystem<TEvents>): void;
  get(id: SystemId): SimulationSystem<TEvents> | undefined;
  has(id: SystemId): boolean;
  /** All systems, in registration order. */
  all(): readonly SimulationSystem<TEvents>[];
  /**
   * Systems in a deterministic dependency-respecting execution order.
   * Throws {@link CircularDependencyError} on a cycle and
   * {@link MissingDependencyError} for an unknown dependency.
   */
  resolveOrder(): readonly SimulationSystem<TEvents>[];
  clear(): void;
}

const dependenciesOf = (system: {
  readonly dependencies?: readonly SystemId[];
}): readonly SystemId[] => system.dependencies ?? [];

export function createSystemRegistry<
  TEvents extends KernelEventMap = KernelEventMap,
>(): SystemRegistry<TEvents> {
  const systems = new Map<SystemId, SimulationSystem<TEvents>>();

  const findCycle = (unplaced: readonly SimulationSystem<TEvents>[]): string[] => {
    const remaining = new Set(unplaced.map((system) => system.id));
    const path: SystemId[] = [];
    const inPath = new Set<SystemId>();

    const visit = (id: SystemId): SystemId[] | null => {
      if (inPath.has(id)) {
        return [...path.slice(path.indexOf(id)), id];
      }
      path.push(id);
      inPath.add(id);
      const system = systems.get(id);
      for (const dependency of system ? dependenciesOf(system) : []) {
        if (remaining.has(dependency)) {
          const cycle = visit(dependency);
          if (cycle) return cycle;
        }
      }
      path.pop();
      inPath.delete(id);
      return null;
    };

    for (const system of unplaced) {
      const cycle = visit(system.id);
      if (cycle) return cycle.map(String);
    }
    return unplaced.map((system) => String(system.id));
  };

  return {
    register(system: SimulationSystem<TEvents>): void {
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
    resolveOrder(): readonly SimulationSystem<TEvents>[] {
      const ordered = [...systems.values()];

      for (const system of ordered) {
        for (const dependency of dependenciesOf(system)) {
          if (!systems.has(dependency)) {
            throw new MissingDependencyError(String(system.id), String(dependency));
          }
        }
      }

      const inDegree = new Map<SystemId, number>();
      for (const system of ordered) {
        inDegree.set(system.id, dependenciesOf(system).length);
      }

      const placed: SimulationSystem<TEvents>[] = [];
      const isPlaced = new Set<SystemId>();

      while (placed.length < ordered.length) {
        const next = ordered.find(
          (system) => !isPlaced.has(system.id) && inDegree.get(system.id) === 0,
        );
        if (next === undefined) {
          const unplaced = ordered.filter((system) => !isPlaced.has(system.id));
          throw new CircularDependencyError(findCycle(unplaced));
        }
        placed.push(next);
        isPlaced.add(next.id);
        for (const system of ordered) {
          if (dependenciesOf(system).includes(next.id)) {
            inDegree.set(system.id, (inDegree.get(system.id) ?? 0) - 1);
          }
        }
      }

      return placed;
    },
  };
}
