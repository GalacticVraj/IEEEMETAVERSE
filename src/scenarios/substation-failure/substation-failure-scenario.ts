import { Severity, asLineId, asLoadId, asScenarioId } from '@app-types';
import type { TickContext } from '@core';

import type { ICrisisScenario, ScenarioContext, ScenarioFaultApi, ScenarioMetadata } from '../crisis-scenario';

/**
 * **Substation Fire** — a fire in the IN2 switchyard isolates the industrial hub.
 *
 * Timeline:
 * - Ticks 0–34:   Fire reported in Industrial zone substation (IN2). Grid nominal
 *                 but risk flag raised. Emergency services deployed.
 * - Tick 35:      Fire protection system triggers — all IN2 breakers open (IN1-IN2,
 *                 IN2-IN3, IN2-RS1). Industrial North cluster islanded.
 * - Ticks 35–54:  IN2 fed only from G-PEAK-IN at IN1 path. Industrial North (IN3)
 *                 completely islanded — no generation.
 * - Tick 55:      Fire suppressed. IN1-IN2 reclose attempted by restoration controller.
 * - Ticks 55–74:  Gradual recovery. RS1-RS2 ring still stressed.
 * - Tick 75:      IN2-RS1 manually reclosed by operator. Full restoration path available.
 */
export class SubstationFailureScenario implements ICrisisScenario {
  public readonly metadata: ScenarioMetadata = {
    id: asScenarioId('substation-failure'),
    name: 'Substation Fire — IN2 Switchyard',
    summary:
      'A fire in the IN2 industrial substation triggers automatic bus protection, '
      + 'islanding the Industrial North cluster and degrading residential south supply.',
    difficulty: Severity.Warning,
  };

  private faults!: ScenarioFaultApi;
  private substationTripped = false;
  private partialRestore = false;

  public setup(context: ScenarioContext): void {
    this.faults = context.faults;
    this.substationTripped = false;
    this.partialRestore = false;
  }

  public onTick(context: TickContext): void {
    const { tick } = context;

    // Tick 35: Fire protection opens all IN2 breakers
    if (tick === 35 && !this.substationTripped) {
      this.faults.commandOpenLine(asLineId('IN1-IN2'));
      this.faults.commandOpenLine(asLineId('IN2-IN3'));
      this.faults.commandOpenLine(asLineId('IN2-RS1'));
      this.substationTripped = true;
    }

    // Tick 75: Emergency load shedding for remaining industrial load
    if (tick === 75 && !this.partialRestore) {
      this.faults.shedLoad(asLoadId('LD-IN-HVY'), 0.50);
      this.partialRestore = true;
    }
  }

  public teardown(): void {
    if (this.partialRestore) {
      this.faults.resetShedding();
    }
    // Line reclose handled by protection engine restoration controller
  }
}
