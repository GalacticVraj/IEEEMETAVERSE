import type { GeneratorId, LineId, LoadId, ScenarioId, Severity } from '@app-types';
import type { TickContext } from '@core';
import type { IGenerationModel, ILoadModel, ISimulationEngine, ProtectionEngine } from '@engine';

export interface ScenarioMetadata {
  readonly id: ScenarioId;
  readonly name: string;
  readonly summary: string;
  readonly difficulty: Severity;
}

/**
 * Subsystem references available to scenarios for fault injection.
 * Scenarios call these during `setup()` to store references, then use them
 * from `onTick()`. This keeps all engine mutation through proper subsystem APIs.
 */
export interface ScenarioFaultApi {
  /** Trip/un-trip a generator from the dispatch merit order. */
  tripGenerator(id: GeneratorId): void;
  untripGenerator(id: GeneratorId): void;
  /** Shed a fraction (0..1) of a specific load block. */
  shedLoad(id: LoadId, fraction: number): void;
  resetShedding(): void;
  /** Manually open a breaker on a line (protection engine command trip). */
  commandOpenLine(line: LineId): void;
}

/** Services a scenario is allowed to touch during setup/teardown. */
export interface ScenarioContext {
  readonly engine: ISimulationEngine;
  /** Direct subsystem fault injection API. */
  readonly faults: ScenarioFaultApi;
  /** Exposed subsystem models (read-only queries). */
  readonly generation: Pick<IGenerationModel, 'isTripped' | 'totalOutput' | 'getGeneratorOutput'>;
  readonly loads: Pick<ILoadModel, 'getShedFraction' | 'totalDemand' | 'getLoadDemand'>;
  readonly protection: Pick<ProtectionEngine, 'thermalFor' | 'breakerFor' | 'relayFor'>;
}

/**
 * Plugin contract for a crisis scenario. New scenarios (heatwave, ice storm,
 * cyber-physical attack, generator loss, …) implement THIS interface and are
 * registered with the {@link ScenarioRegistry}. The engine core references only
 * this contract, so scenarios are added without modifying the engine —
 * the open/closed principle applied to content.
 */
export interface ICrisisScenario {
  readonly metadata: ScenarioMetadata;
  /** One-time configuration against the engine before the run begins. */
  setup(context: ScenarioContext): void;
  /** Per-tick scripting hook (escalation, injected faults, timed events). */
  onTick(context: TickContext): void;
  /** Remove any hooks/state this scenario installed. */
  teardown(): void;
}
