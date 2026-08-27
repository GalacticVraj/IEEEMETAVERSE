import { Severity, asGeneratorId, asLineId, asScenarioId } from '@app-types';
import type { TickContext } from '@core';
import { COLD_ARC } from '@engine';
import type { WeatherArc } from '@engine';

import type {
  ICrisisScenario,
  ScenarioContext,
  ScenarioFaultApi,
  ScenarioMetadata,
} from '../crisis-scenario';
import { at, lerp, ramp } from '../shift-clock';

/**
 * **Cold Snap Demand Spike** — winter grid stress and fuel security.
 *
 * Lives in its own directory rather than replacing the transformer-fault
 * scenario the brief nominated: `equipment-failure/` is an offered, working
 * arc about protection coordination, and overwriting it would have cost one
 * scenario to gain one. This is additive.
 *
 * - T+0:00 → T+0:30 · Temperature falls from 6 °C to −4 °C. Heating demand
 *   climbs with it through the load model's own temperature response — the
 *   spike is a CONSEQUENCE of the weather, not a number typed into a script.
 * - T+0:40 · The first distribution corridor gives out under the new load.
 * - T+1:10 · A second corridor follows as flow re-routes onto it.
 * - T+1:40 · Gas pipeline pressure drops. The two gas peakers — the units the
 *   operator would reach for first — are taken offline.
 *
 * That last beat is the lesson, and it is the one winter storms actually
 * teach: in a cold snap the fuel supply and the electricity demand fail
 * *together*, because the same freeze drives both. Reserve on paper is not
 * reserve if it cannot get fuel.
 */
export class ColdSnapScenario implements ICrisisScenario {
  public readonly metadata: ScenarioMetadata = {
    id: asScenarioId('cold-snap'),
    name: 'Cold Snap Demand Spike',
    summary:
      'Temperature collapses and heating demand climbs with it, distribution corridors ' +
      'overload, then gas pipeline pressure drops and takes the peakers with it.',
    difficulty: Severity.Critical,
  };

  private faults!: ScenarioFaultApi;
  private weather!: ScenarioContext['weather'];
  private corridor1 = false;
  private corridor2 = false;
  private gasDerated = false;

  /** Temperature at the top of the shift, °C. */
  private static readonly TEMP_START = 6;
  /** Where the cold front leaves it, °C. */
  private static readonly TEMP_END = -4;

  public setup(context: ScenarioContext): void {
    this.faults = context.faults;
    this.weather = context.weather;
    this.faults.resetShedding();
    this.weather.setArc(this.arcAt(0));
    this.corridor1 = false;
    this.corridor2 = false;
    this.gasDerated = false;
  }

  public onTick(context: TickContext): void {
    const { tick } = context;

    // The front arrives over the first thirty seconds; the load model's
    // temperature response turns that into heating demand on its own.
    this.weather.setArc(this.arcAt(tick));

    // T+0:40 — first distribution corridor gives out under the new load.
    if (tick === at(0, 40) && !this.corridor1) {
      this.faults.commandOpenLine(asLineId('RN1-RN2'));
      this.corridor1 = true;
    }

    // T+1:10 — flow re-routes and takes the next one with it.
    if (tick === at(1, 10) && !this.corridor2) {
      this.faults.commandOpenLine(asLineId('RS1-RS2'));
      this.corridor2 = true;
    }

    // T+1:40 — pipeline pressure drops. Both gas peakers go: the fuel supply
    // and the demand spike have the same cause, which is what makes a winter
    // event different from a summer one.
    if (tick === at(1, 40) && !this.gasDerated) {
      this.faults.tripGenerator(asGeneratorId('G-PEAK-S'));
      this.faults.tripGenerator(asGeneratorId('G-PEAK-IN'));
      this.gasDerated = true;
    }
  }

  /** The environment at a given tick — one pure function, no hidden state. */
  private arcAt(tick: number): WeatherArc {
    const front = ramp(tick, 0, at(0, 30));
    return {
      ...COLD_ARC,
      baseTempC: lerp(ColdSnapScenario.TEMP_START, ColdSnapScenario.TEMP_END, front),
      heatAmplitudeC: 0,
    };
  }

  public teardown(): void {
    if (this.gasDerated) {
      this.faults.untripGenerator(asGeneratorId('G-PEAK-S'));
      this.faults.untripGenerator(asGeneratorId('G-PEAK-IN'));
    }
    this.faults.resetShedding();
  }
}
