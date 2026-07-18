import type { ScenarioId, Severity } from '@app-types';
import type { TickContext } from '@core';
import type { ISimulationEngine } from '@engine';

export interface ScenarioMetadata {
  readonly id: ScenarioId;
  readonly name: string;
  readonly summary: string;
  readonly difficulty: Severity;
}

/** Services a scenario is allowed to touch during setup/teardown. */
export interface ScenarioContext {
  readonly engine: ISimulationEngine;
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
