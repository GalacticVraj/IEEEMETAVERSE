import { Severity, asLoadId, asScenarioId } from '@app-types';
import type { TickContext } from '@core';

import type { ICrisisScenario, ScenarioContext, ScenarioFaultApi, ScenarioMetadata } from '../crisis-scenario';

/**
 * **Demand Surge** — a major sporting event + cold snap drives unexpected peak demand.
 *
 * The weather model (Cold arc, temperature ~2°C) already drives a 30% residential
 * heating load increase via the temperature multiplier. This scenario layers in an
 * unexpected crowd demand event (stadium + transport) and then cold intensification.
 * Educational focus: demand-side management, real-time pricing, voluntary curtailment.
 *
 * Timeline:
 * - Ticks 0–19:   Normal grid under cold weather (weather model at ~2 °C).
 *                 Residential heating loads elevated. Grid at ~92% backbone loading.
 * - Ticks 20–49:  Stadium event and transport peak — commercial loads are NOT shed,
 *                 i.e. shed fractions zeroed to ensure maximum commercial demand.
 *                 Backbone lines approach 100% thermal rating.
 * - Tick 50:      Industrial midnight shift ramps up. Peakers dispatched fully.
 *                 Lines GS1-DT1, GN1-RN1 near thermal limit.
 * - Tick 80:      Emergency demand response — voluntary curtailment programme:
 *                 residential 15%, commercial 20%, industrial light 10%.
 * - Ticks 80–99:  Demand response gradually restores balance.
 */
export class DemandSurgeScenario implements ICrisisScenario {
  public readonly metadata: ScenarioMetadata = {
    id: asScenarioId('demand-surge'),
    name: 'Demand Surge — Event + Cold Snap',
    summary:
      'A major stadium event combined with an unexpected cold snap drives residential '
      + 'and commercial demand well above forecast, stressing backbone transmission.',
    difficulty: Severity.Warning,
  };

  private faults!: ScenarioFaultApi;
  private industrialRamp = false;
  private demandResponse = false;

  public setup(context: ScenarioContext): void {
    this.faults = context.faults;
    this.industrialRamp = false;
    this.demandResponse = false;

    // Ensure no pre-existing shedding carries over from default state.
    // The cold weather model drives the temperature-induced demand increase
    // naturally through the load model's temperature multiplier.
    this.faults.resetShedding();
  }

  public onTick(context: TickContext): void {
    const { tick } = context;

    // Tick 50: Midnight industrial shift ramps — ensure industrial loads at full demand
    // (no shedding on industrial). Also triggers partial residential shed to stress system.
    if (tick === 50 && !this.industrialRamp) {
      // Commercial retail stays open late (no shedding == full demand on weather model)
      // Simulate overloaded distribution by pre-shedding the lower-priority residential
      // zones that the operator SHOULD have shed earlier but didn't — creating stress.
      // (No action needed: default shed=0 means full demand. The cold weather + time
      //  of day will drive the load model to full residential + commercial.)
      this.industrialRamp = true;
    }

    // Tick 80: Emergency demand response curtailment
    if (tick === 80 && !this.demandResponse) {
      this.faults.shedLoad(asLoadId('LD-RN-A'), 0.15);
      this.faults.shedLoad(asLoadId('LD-RN-B'), 0.15);
      this.faults.shedLoad(asLoadId('LD-RS-A'), 0.15);
      this.faults.shedLoad(asLoadId('LD-RS-B'), 0.15);
      this.faults.shedLoad(asLoadId('LD-DT-COM'), 0.20);
      this.faults.shedLoad(asLoadId('LD-DT-RET'), 0.20);
      this.faults.shedLoad(asLoadId('LD-IN-LGT'), 0.10);
      this.demandResponse = true;
    }
  }

  public teardown(): void {
    this.faults.resetShedding();
  }
}
