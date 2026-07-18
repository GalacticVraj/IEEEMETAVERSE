import type { ScenarioId } from '@app-types';
import { GridGuardError, createToken } from '@core';
import type { Token } from '@core';

import type { ICrisisScenario } from './crisis-scenario';

/**
 * Registry of available crisis scenarios. Real (not a placeholder): it is the
 * seam that lets scenarios be discovered and selected without the engine
 * knowing any concrete scenario. Register plugins at composition time.
 */
export interface ScenarioRegistry {
  register(scenario: ICrisisScenario): void;
  get(id: ScenarioId): ICrisisScenario | undefined;
  has(id: ScenarioId): boolean;
  all(): readonly ICrisisScenario[];
}

export const SCENARIO_REGISTRY: Token<ScenarioRegistry> = createToken('ScenarioRegistry');

export function createScenarioRegistry(): ScenarioRegistry {
  const scenarios = new Map<ScenarioId, ICrisisScenario>();

  return {
    register(scenario: ICrisisScenario): void {
      const { id } = scenario.metadata;
      if (scenarios.has(id)) {
        throw new GridGuardError(`Scenario already registered: ${id}`);
      }
      scenarios.set(id, scenario);
    },
    get: (id) => scenarios.get(id),
    has: (id) => scenarios.has(id),
    all: () => [...scenarios.values()],
  };
}
