import { Severity, asGeneratorId, asScenarioId } from '@app-types';
import type { TickContext } from '@core';

import type { ICrisisScenario, ScenarioContext, ScenarioFaultApi, ScenarioMetadata } from '../crisis-scenario';

/**
 * **Record Heatwave** — the flagship scenario, choreographed for a 3-minute
 * demonstration arc (winner-mode C3):
 *
 * - Ticks 0–299 (T+0:00–0:30, afternoon): orientation. Cooling load climbs
 *   with the heat; the operator reads the console and city.
 * - Tick 300 (T+0:30): FIRST TENSION — the harbor gas unit (G-GAS-HB, 60 MW)
 *   trips on a heat-stressed voltage regulator. Small, legible, explained.
 * - Ticks 300–599: peakers and imports ramp; corridor stress builds into
 *   golden hour.
 * - Tick 600 (T+1:00, golden hour): THE BIG ONE — baseload G-BASE-S (400 MW)
 *   loses cooling water. The evening peak now exceeds surviving capacity;
 *   only operator action closes the gap. No scripted rescue — the automatic
 *   industrial shed was removed so the outcome belongs to the player.
 * - Dusk → night: protection, cascade risk, and the director resolve the
 *   consequences of whatever the operator did (or didn't do).
 * - Teardown: restores all trips to default state.
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

  public setup(context: ScenarioContext): void {
    this.faults = context.faults;
    this.baseloadTripped = false;
    this.gasHarborTripped = false;
  }

  public onTick(context: TickContext): void {
    const { tick } = context;

    // Tick 300 (T+0:30): first tension — harbor gas unit trips on a
    // heat-stressed voltage regulator. Small enough to explain, real enough
    // to move the balance.
    if (tick === 300 && !this.gasHarborTripped) {
      this.faults.tripGenerator(asGeneratorId('G-GAS-HB'));
      this.gasHarborTripped = true;
    }

    // Tick 600 (T+1:00, golden hour): the big one — baseload cooling failure.
    // From here the evening peak exceeds surviving capacity; the outcome
    // belongs to the operator. (No scripted rescue shed — removed by design.)
    if (tick === 600 && !this.baseloadTripped) {
      this.faults.tripGenerator(asGeneratorId('G-BASE-S'));
      this.baseloadTripped = true;
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
    // Any shedding this run belongs to the operator; reset it regardless.
    this.faults.resetShedding();
  }
}
