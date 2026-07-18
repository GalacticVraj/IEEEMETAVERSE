import { Severity, asGeneratorId, asLineId, asLoadId, asScenarioId } from '@app-types';
import type { TickContext } from '@core';

import type { ICrisisScenario, ScenarioContext, ScenarioFaultApi, ScenarioMetadata } from '../crisis-scenario';

/**
 * **Transformer Failure** — EHV autotransformer turn-to-turn fault.
 *
 * The GS1 generation bus autotransformer develops a turn-to-turn fault, causing
 * differential protection to clear, removing both generation feed paths simultaneously.
 * This is a single-point-of-failure demonstration for the southern generation hub.
 *
 * Timeline:
 * - Ticks 0–44:   Transformer fault evolving. Thermal signature detectable.
 *                 Pre-fault: grid at heavy load (95% backbone).
 * - Tick 45:      Transformer differential clears — GS1-DT1 trips (400 MW infeed out).
 * - Tick 45:      GS1-IN1 also trips (same differential zone).
 * - Ticks 46–54:  Immediate 400 MW infeed deficit — GS1 generation buses isolated.
 *                 G-BASE-S and G-PEAK-S output stranded (cannot export).
 *                 Grid fed only from GN1, G-IMPORT, G-BATT-DT.
 * - Tick 55:      G-BASE-S trips (islanded generator, loss of excitation).
 *                 G-PEAK-S also trips.
 * - Ticks 55–79:  Large generation deficit. Import at max. Battery draining fast.
 * - Tick 80:      Emergency load shedding — industrial 50%.
 * - Ticks 80–99:  Controlled reduction. Grid survives at degraded level.
 */
export class TransformerFailureScenario implements ICrisisScenario {
  public readonly metadata: ScenarioMetadata = {
    id: asScenarioId('transformer-failure'),
    name: 'EHV Autotransformer Turn-to-Turn Fault',
    summary:
      'A turn-to-turn fault on the GS1 autotransformer trips both 400 MW infeed paths, '
      + 'stranding the southern generation hub and forcing emergency load shedding.',
    difficulty: Severity.Critical,
  };

  private faults!: ScenarioFaultApi;
  private transformerCleared = false;
  private generationIslanded = false;
  private loadShed = false;

  public setup(context: ScenarioContext): void {
    this.faults = context.faults;
    this.transformerCleared = false;
    this.generationIslanded = false;
    this.loadShed = false;
  }

  public onTick(context: TickContext): void {
    const { tick } = context;

    // Tick 45: Differential protection clears both GS1 infeed lines
    if (tick === 45 && !this.transformerCleared) {
      this.faults.commandOpenLine(asLineId('GS1-DT1'));
      this.faults.commandOpenLine(asLineId('GS1-IN1'));
      this.faults.commandOpenLine(asLineId('GS1-RS1'));
      this.transformerCleared = true;
    }

    // Tick 55: Islanded generators trip on loss of excitation
    if (tick === 55 && !this.generationIslanded) {
      this.faults.tripGenerator(asGeneratorId('G-BASE-S'));
      this.faults.tripGenerator(asGeneratorId('G-PEAK-S'));
      this.generationIslanded = true;
    }

    // Tick 80: Emergency load shedding
    if (tick === 80 && !this.loadShed) {
      this.faults.shedLoad(asLoadId('LD-IN-HVY'), 0.50);
      this.faults.shedLoad(asLoadId('LD-IN-LGT'), 0.50);
      this.faults.shedLoad(asLoadId('LD-HB-IND'), 0.40);
      this.faults.shedLoad(asLoadId('LD-HB-SHIP'), 0.40);
      this.loadShed = true;
    }
  }

  public teardown(): void {
    if (this.generationIslanded) {
      this.faults.untripGenerator(asGeneratorId('G-BASE-S'));
      this.faults.untripGenerator(asGeneratorId('G-PEAK-S'));
    }
    if (this.loadShed) {
      this.faults.resetShedding();
    }
    // Line restoration by protection engine
  }
}
