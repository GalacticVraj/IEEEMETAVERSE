import { Severity, asGeneratorId, asLineId, asScenarioId } from '@app-types';
import type { TickContext } from '@core';

import type { ICrisisScenario, ScenarioContext, ScenarioFaultApi, ScenarioMetadata } from '../crisis-scenario';

/**
 * **Coastal Storm** — a deep low-pressure system batters Meridian Bay.
 *
 * Timeline:
 * - Ticks 0–29:   Storm builds — high wind (good for turbines), but lightning strike
 *                 risk rises. Grid stable; renewable output near maximum.
 * - Tick 30:      Lightning trips the GN1-DT1 renewable export line (key infeed).
 * - Ticks 31–49:  DT1 fed only from GS1-DT1; that line approaches thermal limit.
 * - Tick 50:      Salt spray flashover trips HB1-HB2 and RS3-HB1 — Harbor isolated.
 * - Ticks 50–79:  Harbor zone degrades. Water treatment at risk.
 * - Tick 80:      Wind generator trips due to overspeed protection.
 * - Ticks 80–99:  Reduced renewable output + two lines out = high cascade risk.
 */
export class StormScenario implements ICrisisScenario {
  public readonly metadata: ScenarioMetadata = {
    id: asScenarioId('storm'),
    name: 'Coastal Storm',
    summary:
      'A violent coastal storm trips critical transmission lines via lightning and flashover, '
      + 'while the wind farm ultimately shuts down on overspeed, fragmenting the grid.',
    difficulty: Severity.Critical,
  };

  private faults!: ScenarioFaultApi;
  private renewableLineTrpped = false;
  private harborLinesTrpped = false;
  private windTrpped = false;

  public setup(context: ScenarioContext): void {
    this.faults = context.faults;
    this.renewableLineTrpped = false;
    this.harborLinesTrpped = false;
    this.windTrpped = false;
  }

  public onTick(context: TickContext): void {
    const { tick } = context;

    // Tick 30: Lightning strike trips renewable export line GN1-DT1
    if (tick === 30 && !this.renewableLineTrpped) {
      this.faults.commandOpenLine(asLineId('GN1-DT1'));
      this.renewableLineTrpped = true;
    }

    // Tick 50: Salt spray flashover — Harbor partially isolated
    if (tick === 50 && !this.harborLinesTrpped) {
      this.faults.commandOpenLine(asLineId('HB1-HB2'));
      this.harborLinesTrpped = true;
    }

    // Tick 80: Wind generator overspeed protection trips
    if (tick === 80 && !this.windTrpped) {
      this.faults.tripGenerator(asGeneratorId('G-WIND'));
      this.windTrpped = true;
    }
  }

  public teardown(): void {
    if (this.windTrpped) {
      this.faults.untripGenerator(asGeneratorId('G-WIND'));
    }
    // Line re-closures handled by ProtectionEngine restoration controller
  }
}
