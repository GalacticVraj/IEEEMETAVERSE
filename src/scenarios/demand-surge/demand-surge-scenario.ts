import { Severity, asScenarioId } from '@app-types';
import type { TickContext } from '@core';
import { CLEAR_ARC } from '@engine';
import type { WeatherArc } from '@engine';

import type {
  ICrisisScenario,
  ScenarioContext,
  ScenarioFaultApi,
  ScenarioMetadata,
} from '../crisis-scenario';
import { at, lerp, ramp } from '../shift-clock';
import { setGenerationForecast, clearGenerationForecast } from '../generation-forecast';

/**
 * **Renewable Intermittency Cascade** — the duck curve, lived through.
 *
 * This replaces the previous "stadium event + cold snap" arc, whose only
 * scripted beat set a boolean and did nothing (its own comment said so), and
 * whose second beat shed load FOR the operator. Neither taught anything.
 *
 * Every beat here moves the environment, not an output number, because the
 * generation model already derives Solar from `irradiance` and Wind from
 * `wind`. Drop the irradiance and the solar farm falls off on its own, through
 * the same dispatch and frequency physics that judge the operator afterwards.
 *
 * - T+0:00 · Clear sky, solar at its ceiling, wind healthy. Comfortable.
 * - T+0:15 → T+1:00 · A cloud bank crosses the array. Irradiance falls to 35 %
 *   of clear-sky over ninety seconds — fast enough to matter, slow enough that
 *   an operator watching the forecast panel can act before it bites.
 * - T+0:50 → T+1:20 · The forecast misses: wind drops to 45 % of the morning
 *   run. Both renewables are now going the same way at once, which is exactly
 *   the correlation that makes intermittency hard.
 * - T+1:00 onward · The evening demand ramp arrives on the sun's way out. This
 *   is the belly of the duck: least renewable output, most demand.
 *
 * The mechanic is the FORECAST. `generation-forecast` publishes what the
 * scenario expected against what the grid actually produced, so the player can
 * see the miss opening up in front of them — and learns why storage and
 * reserve are bought, rather than being told.
 */
export class DemandSurgeScenario implements ICrisisScenario {
  public readonly metadata: ScenarioMetadata = {
    id: asScenarioId('demand-surge'),
    name: 'Renewable Intermittency Cascade',
    summary:
      'A cloud bank crosses the solar array while the wind forecast misses low, and the ' +
      'evening demand ramp arrives on top of both. The duck curve, at full scale.',
    difficulty: Severity.Warning,
  };

  private faults!: ScenarioFaultApi;
  private weather!: ScenarioContext['weather'];

  /** Clear-sky ceiling before the cloud bank. */
  private static readonly SOLAR_START = 0.92;
  /** What the array is left with under heavy cloud. */
  private static readonly SOLAR_END = 0.32;
  /** Wind availability the forecast promised. */
  private static readonly WIND_START = 0.55;
  /** What actually arrives. */
  private static readonly WIND_END = 0.25;

  public setup(context: ScenarioContext): void {
    this.faults = context.faults;
    this.weather = context.weather;
    this.faults.resetShedding();
    this.weather.setArc(this.arcAt(0));
    // The forecast is the promise. It is published once, up front, and never
    // moved — a forecast that quietly corrects itself to match reality is not
    // a forecast, and would hide the entire lesson.
    setGenerationForecast({
      solarAtCeiling: DemandSurgeScenario.SOLAR_START,
      windForecast: DemandSurgeScenario.WIND_START,
      note: 'Day-ahead forecast: clear sky, steady onshore breeze.',
    });
  }

  public onTick(context: TickContext): void {
    // Re-profiling the environment every tick is the point: this is a weather
    // EVENT unfolding, not a step change. The arc is cheap to compute and the
    // model recomputes from it immediately.
    this.weather.setArc(this.arcAt(context.tick));
  }

  /** The environment at a given tick — one pure function, no hidden state. */
  private arcAt(tick: number): WeatherArc {
    const cloud = ramp(tick, at(0, 15), at(0, 45)); // 90 s of cloud arriving
    const windMiss = ramp(tick, at(0, 50), at(0, 30)); // 30 s of wind falling away

    return {
      ...CLEAR_ARC,
      // A mild evening — the demand ramp here is the diurnal one already in
      // the load model, not an invented spike.
      baseTempC: 26,
      heatAmplitudeC: 3,
      irradianceBase: lerp(DemandSurgeScenario.SOLAR_START, DemandSurgeScenario.SOLAR_END, cloud),
      windBase: lerp(DemandSurgeScenario.WIND_START, DemandSurgeScenario.WIND_END, windMiss),
      windGust: 0.08,
    };
  }

  public teardown(): void {
    this.faults.resetShedding();
    this.weather.setArc(CLEAR_ARC);
    clearGenerationForecast();
  }
}
