import { Severity, asScenarioId } from '@app-types';
import { notImplemented } from '@core';
import type { TickContext } from '@core';

import type { ICrisisScenario, ScenarioContext, ScenarioMetadata } from '../crisis-scenario';

/**
 * The flagship scenario: a record heatwave over Meridian Bay. Metadata is real
 * (so the scenario is selectable in Phase 1); the behavioral hooks are
 * placeholders describing what Phase 2/7 will script.
 */
export class HeatwaveScenario implements ICrisisScenario {
  public readonly metadata: ScenarioMetadata = {
    id: asScenarioId('heatwave'),
    name: 'Record Heatwave',
    summary: 'A record heatwave drives cooling demand past safe limits across Meridian Bay.',
    difficulty: Severity.Warning,
  };

  public setup(context: ScenarioContext): void {
    notImplemented(
      'HeatwaveScenario.setup',
      'Install the heatwave temperature curve and configure initial dispatch/topology.',
      { context },
    );
  }

  public onTick(context: TickContext): void {
    notImplemented(
      'HeatwaveScenario.onTick',
      'Escalate demand along the heatwave arc and inject timed grid stress.',
      { context },
    );
  }

  public teardown(): void {
    notImplemented('HeatwaveScenario.teardown', 'Remove scenario hooks and restore defaults.');
  }
}
