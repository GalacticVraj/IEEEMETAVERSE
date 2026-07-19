import { Severity, asGeneratorId, asLoadId, asScenarioId } from '@app-types';
import type { TickContext } from '@core';

import type { ICrisisScenario, ScenarioContext, ScenarioFaultApi, ScenarioMetadata } from '../crisis-scenario';

/**
 * **Record Heatwave** — the flagship scenario.
 *
 * Timeline:
 * - Ticks 0–59:   Residential cooling load surges. Peak demand approaches 130 % of normal.
 * - Tick 60:      Baseload generator (G-BASE-S, 400 MW) trips — cooling system failure.
 * - Ticks 61–79:  Peakers ramp, import maxes out; backbone lines (GS1-DT1, GS1-IN1)
 *                 become severely overloaded.
 * - Tick 80:      Gas peaker harbor (G-GAS-HB) also trips — voltage regulator fault.
 * - Ticks 80–99:  Cascade risk high; operator must decide to shed load or accept blackout.
 * - Tick 100:     If still running, partial load shedding kicks in automatically
 *                 (industrial non-critical loads reduced 30 %).
 * - Teardown:     Restores all trips and shedding to default state.
 */
export class HeatwaveScenario implements ICrisisScenario {
  public readonly metadata: ScenarioMetadata = {
    id: asScenarioId('heatwave'),
    name: 'Record Heatwave',
    summary:
      'A record heatwave drives cooling demand past safe limits across Meridian Bay, '
      + 'then a baseload generator trips its cooling system, forcing the grid toward cascade failure.',
    difficulty: Severity.Warning,
  };

  private faults!: ScenarioFaultApi;
  private baseloadTripped = false;
  private gasHarborTripped = false;
  private industrialShedApplied = false;

  public setup(context: ScenarioContext): void {
    this.faults = context.faults;
    this.baseloadTripped = false;
    this.gasHarborTripped = false;
    this.industrialShedApplied = false;
  }

  public onTick(context: TickContext): void {
    const { tick } = context;

    // Tick 60: Baseload generator trips (cooling water pump failure)
    if (tick === 60 && !this.baseloadTripped) {
      this.faults.tripGenerator(asGeneratorId('G-BASE-S'));
      this.baseloadTripped = true;
    }

    // Tick 80: Harbor gas peaker also trips (voltage regulator fault from heat)
    if (tick === 80 && !this.gasHarborTripped) {
      this.faults.tripGenerator(asGeneratorId('G-GAS-HB'));
      this.gasHarborTripped = true;
    }

    // Tick 100: Emergency partial load shedding — industrial non-critical loads 30%
    if (tick === 100 && !this.industrialShedApplied) {
      this.faults.shedLoad(asLoadId('LD-IN-HVY'), 0.30);
      this.faults.shedLoad(asLoadId('LD-IN-LGT'), 0.30);
      this.faults.shedLoad(asLoadId('LD-HB-IND'), 0.20);
      this.faults.shedLoad(asLoadId('LD-HB-SHIP'), 0.25);
      this.industrialShedApplied = true;
    }
  }

  public teardown(): void {
    // Restore all fault injections on teardown
    if (this.baseloadTripped) {
      this.faults.untripGenerator(asGeneratorId('G-BASE-S'));
    }
    if (this.gasHarborTripped) {
      this.faults.untripGenerator(asGeneratorId('G-GAS-HB'));
    }
    if (this.industrialShedApplied) {
      this.faults.resetShedding();
    }
  }
}
