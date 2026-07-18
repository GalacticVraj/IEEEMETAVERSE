/**
 * Factory that builds the `ScenarioContext` handed to each `ICrisisScenario.setup()`.
 *
 * Lives in the engine layer because it needs direct references to the engine
 * subsystems. The scenarios layer depends on `@engine`; the engine never
 * depends on the scenarios — the one-way dependency is preserved.
 *
 * Note: `tick` is captured at factory time as 0. For `commandOpenLine` and
 * `commandClose`, the protection engine will receive the latest tick via
 * the engine's `step()` pipeline. Scenarios that need a tick number for the
 * breaker command receive `0` as a sentinel — the protection engine ignores
 * the tick argument for state entry (it only uses it for elapsed timing).
 */
import type { GeneratorId, LineId, LoadId } from '@app-types';

import type { IGenerationModel } from './generation/generation';
import type { ILoadModel } from './loads/loads';
import type { ProtectionEngine } from './protection/protection-engine';
import type { ISimulationEngine } from './simulation-engine';

/** Public shape exposed to scenario plugins. */
export interface ScenarioContextDeps {
  readonly engine: ISimulationEngine;
  readonly generation: IGenerationModel;
  readonly loads: ILoadModel;
  readonly protection: ProtectionEngine;
}

/**
 * Builds the scenario context object that is passed into `ICrisisScenario.setup()`.
 * Imported and used by the composition root to decouple wiring from the
 * concrete engine implementations.
 */
export function buildScenarioFaultApi(deps: ScenarioContextDeps) {
  return {
    tripGenerator(id: GeneratorId): void {
      deps.generation.tripGenerator(id);
    },
    untripGenerator(id: GeneratorId): void {
      deps.generation.untripGenerator(id);
    },
    shedLoad(id: LoadId, fraction: number): void {
      deps.loads.shedLoad(id, fraction);
    },
    resetShedding(): void {
      deps.loads.resetShedding();
    },
    commandOpenLine(line: LineId): void {
      // tick=0 sentinel: the breaker state machine uses tick for elapsed timing,
      // but the protection engine's evaluate() will re-sync state on next tick.
      deps.protection.commandOpen(line, 0);
    },
  };
}
