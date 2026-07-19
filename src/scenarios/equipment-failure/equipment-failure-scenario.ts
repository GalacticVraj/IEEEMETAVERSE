import { Severity, asLineId, asScenarioId } from '@app-types';
import type { TickContext } from '@core';

import type { ICrisisScenario, ScenarioContext, ScenarioFaultApi, ScenarioMetadata } from '../crisis-scenario';

/**
 * **Equipment Failure** — a transformer differential fault on the main infeed.
 *
 * Timeline:
 * - Ticks 0–19:   Grid nominal. Transformer pre-fault thermal signature building.
 * - Tick 20:      DT4-HB1 line trips (transformer differential protection clears fault).
 * - Ticks 21–39:  Power re-routes via DT1-IN1 + IN1-HB1; those lines now heavily loaded.
 * - Tick 40:      IN1-HB1 trips (thermal overload after re-routing).
 * - Ticks 40–59:  Harbor now fed only via RS3-HB1 — single-point-of-failure.
 * - Tick 60:      DT1-IN1 also trips (thermal limit breached). Industrial zone degraded.
 * - Ticks 60–99:  Grid approaching N-2 contingency violation; operator must act.
 */
export class EquipmentFailureScenario implements ICrisisScenario {
  public readonly metadata: ScenarioMetadata = {
    id: asScenarioId('equipment-failure'),
    name: 'Transformer Differential Fault',
    summary:
      'A transformer internal fault trips the DT4-HB1 main infeed, forcing power '
      + 're-routing that thermally overloads backup paths in sequential failure.',
    difficulty: Severity.Warning,
  };

  private faults!: ScenarioFaultApi;
  private fault1 = false;
  private fault2 = false;
  private fault3 = false;

  public setup(context: ScenarioContext): void {
    this.faults = context.faults;
    this.fault1 = false;
    this.fault2 = false;
    this.fault3 = false;
  }

  public onTick(context: TickContext): void {
    const { tick } = context;

    // Tick 20: Transformer differential clears DT4-HB1
    if (tick === 20 && !this.fault1) {
      this.faults.commandOpenLine(asLineId('DT4-HB1'));
      this.fault1 = true;
    }

    // Tick 40: Thermal overload trips IN1-HB1
    if (tick === 40 && !this.fault2) {
      this.faults.commandOpenLine(asLineId('IN1-HB1'));
      this.fault2 = true;
    }

    // Tick 60: DT1-IN1 thermal limit breached
    if (tick === 60 && !this.fault3) {
      this.faults.commandOpenLine(asLineId('DT1-IN1'));
      this.fault3 = true;
    }
  }

  public teardown(): void {
    // Line restoration handled by protection engine auto-reclose
  }
}
