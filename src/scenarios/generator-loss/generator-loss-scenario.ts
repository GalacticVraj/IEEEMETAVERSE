import { Severity, asGeneratorId, asLoadId, asScenarioId } from '@app-types';
import type { TickContext } from '@core';

import type { ICrisisScenario, ScenarioContext, ScenarioFaultApi, ScenarioMetadata } from '../crisis-scenario';

/**
 * **Generator Loss Contingency** — simultaneous loss of large baseload + peaker.
 *
 * This scenario tests the N-2 security criterion and demonstrates the importance
 * of spinning reserve. Two generation units trip simultaneously due to a
 * mechanical failure (turbine blade fracture on baseload, sympathetic vibration
 * trips the co-located gas peaker).
 *
 * Timeline:
 * - Ticks 0–24:   Grid at peak demand (90 % loading). Normal operations.
 * - Tick 25:      G-BASE-S (400 MW baseload) trips — turbine blade fracture.
 * - Tick 25:      G-PEAK-S (150 MW co-located peaker) trips — sympathetic vibration.
 * - Ticks 26–44:  Immediate 550 MW generation deficit. Peakers scrambling to ramp.
 *                 Frequency droops. Import and battery ramp urgently.
 * - Ticks 45–64:  If operator doesn't shed load, frequency collapses to ~58 Hz.
 * - Tick 65:      Auto load shedding — industrial 50%, residential 20%.
 * - Ticks 65–99:  Frequency recovers as generation catches up.
 */
export class GeneratorLossScenario implements ICrisisScenario {
  public readonly metadata: ScenarioMetadata = {
    id: asScenarioId('generator-loss'),
    name: 'Generator Loss — N-2 Contingency',
    summary:
      'Simultaneous loss of 550 MW of baseload generation due to a turbine '
      + 'blade fracture, testing spinning reserve and frequency stability.',
    difficulty: Severity.Critical,
  };

  private faults!: ScenarioFaultApi;
  private generationLost = false;
  private loadShed = false;

  public setup(context: ScenarioContext): void {
    this.faults = context.faults;
    this.generationLost = false;
    this.loadShed = false;
  }

  public onTick(context: TickContext): void {
    const { tick } = context;

    // Tick 25: Simultaneous loss of baseload + co-located peaker (N-2)
    if (tick === 25 && !this.generationLost) {
      this.faults.tripGenerator(asGeneratorId('G-BASE-S')); // 400 MW
      this.faults.tripGenerator(asGeneratorId('G-PEAK-S')); // 150 MW
      this.generationLost = true;
    }

    // Tick 65: Automatic frequency-triggered load shedding
    if (tick === 65 && !this.loadShed) {
      this.faults.shedLoad(asLoadId('LD-IN-HVY'), 0.50);
      this.faults.shedLoad(asLoadId('LD-IN-LGT'), 0.40);
      this.faults.shedLoad(asLoadId('LD-RN-A'), 0.20);
      this.faults.shedLoad(asLoadId('LD-RN-B'), 0.20);
      this.faults.shedLoad(asLoadId('LD-RS-A'), 0.20);
      this.faults.shedLoad(asLoadId('LD-RS-B'), 0.20);
      this.loadShed = true;
    }
  }

  public teardown(): void {
    if (this.generationLost) {
      this.faults.untripGenerator(asGeneratorId('G-BASE-S'));
      this.faults.untripGenerator(asGeneratorId('G-PEAK-S'));
    }
    if (this.loadShed) {
      this.faults.resetShedding();
    }
  }
}
