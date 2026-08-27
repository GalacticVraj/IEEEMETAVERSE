import type { Celsius, Ratio, WeatherKind } from '@app-types';
import { createToken } from '@core';
import type { TickContext, Token } from '@core';

export interface WeatherState {
  readonly kind: WeatherKind;
  readonly temperature: Celsius;
  /** Solar irradiance as a 0..1 fraction of clear-sky peak. */
  readonly irradiance: Ratio;
  /** Wind availability as a 0..1 fraction of rated. */
  readonly wind: Ratio;
}

/**
 * The environmental profile a scenario runs under.
 *
 * This exists because the three weather arcs below were written, tested, and
 * then never reached the running app: the composition root registered ONE
 * generic `DeterministicWeatherModel` for every scenario. The consequences
 * were not cosmetic. "Record Heatwave" ran at a flat 25 °C with no heat build,
 * so the cooling-demand ramp it is named after never happened; "Coastal Storm"
 * ran at wind 0.3, which `classifyKind` reads as Clear, so the lightning
 * effects — gated on `weatherKind === 'Storm'` — could never fire and the
 * storm scenario was a heatwave without the heat.
 *
 * Making the arc settable lets each scenario declare its own environment, and
 * lets a scenario MOVE it during a run (a cloud bank crossing a solar farm) —
 * which drives real generation physics, because the generation model already
 * derives Solar output from `irradiance` and Wind output from `wind`.
 */
export interface WeatherArc {
  /** Ambient baseline, °C. */
  readonly baseTempC: number;
  /** Peak additional heat reached about two-thirds through the shift, °C. */
  readonly heatAmplitudeC: number;
  /** Mean wind availability, 0..1 of rated. */
  readonly windBase: number;
  /** Slow gust swing either side of `windBase`, 0..1. */
  readonly windGust: number;
  /** Clear-sky irradiance ceiling before the day/night arc is applied, 0..1. */
  readonly irradianceBase: number;
}

/** Drives environmental conditions that push demand and renewable output. */
export interface IWeatherModel {
  current(): WeatherState;
  /** Advance the weather one tick and return the new state. */
  advance(context: TickContext): WeatherState;
  /**
   * Re-profile the environment. Configuration, not physics: it changes the
   * INPUTS the same equations are evaluated with. Scenarios call this in
   * `setup()` to declare their arc, and may call it during a run to script a
   * weather event such as cloud cover arriving.
   */
  setArc(arc: WeatherArc): void;
}

/** Mild, unremarkable conditions — the default when a scenario says nothing. */
export const CLEAR_ARC: WeatherArc = {
  baseTempC: 25,
  heatAmplitudeC: 0,
  windBase: 0.3,
  windGust: 0.2,
  irradianceBase: 0.7,
};

/** Record heat: 32 °C climbing past 43 °C into the evening peak. */
export const HEATWAVE_ARC: WeatherArc = {
  baseTempC: 32,
  heatAmplitudeC: 11,
  windBase: 0.15,
  windGust: 0.1,
  irradianceBase: 0.6,
};

/**
 * Coastal storm: heavy overcast and sustained high wind.
 *
 * The gust swing is deliberately small. With the default 0.2 swing a windBase
 * of 0.85 dips to 0.65 at the trough — under the 0.7 Storm threshold — so the
 * weather would flap between Storm and Clear twice a shift and the lightning
 * would switch itself off mid-storm.
 */
export const STORM_ARC: WeatherArc = {
  baseTempC: 18,
  heatAmplitudeC: 0,
  windBase: 0.88,
  windGust: 0.1,
  irradianceBase: 0.15,
};

/** Cold snap: near-freezing, weak sun, light wind. */
export const COLD_ARC: WeatherArc = {
  baseTempC: 2,
  heatAmplitudeC: 0,
  windBase: 0.25,
  windGust: 0.12,
  irradianceBase: 0.3,
};

export const WEATHER_MODEL: Token<IWeatherModel> = createToken('WeatherModel');

// ---------------------------------------------------------------------------
// Deterministic weather arcs. Each scenario overrides which arc is active.
// ---------------------------------------------------------------------------

/**
 * The shift is ONE arc, not a loop: 1,800 ticks of late afternoon running into
 * night. Both the day/night rendering rig and the scenario script assume that
 * shape, and the weather model has to agree with them — otherwise the sun sets
 * eighteen times while the city visibly darkens once, and the solar farm
 * produces nothing at the afternoon peak it is meant to cover.
 */
export const RUN_TICKS = 1800;

/** Run progress, clamped to [0,1]. */
const progressAt = (tick: number): number => Math.min(1, Math.max(0, tick / RUN_TICKS));

/**
 * Daylight strength: full through the first 30 % of the shift, then a
 * smoothstep down to darkness. Mirrors `nightFactor` in the rendering rig so
 * the physics and the picture describe the same evening.
 */
export function daylightFactor(tick: number): number {
  const t = Math.min(1, Math.max(0, (progressAt(tick) - 0.3) / 0.6));
  const night = t * t * (3 - 2 * t); // smoothstep
  return 1 - night;
}

/**
 * Heat builds through the afternoon and peaks into the evening — the reason
 * the heatwave bites exactly when solar is leaving. A half-sine over the run
 * rises once and eases once; the previous 200-tick period oscillated four and
 * a half times across a single shift.
 */
const heatwaveTemp = (tick: number, base: Celsius, amplitude: Celsius): Celsius =>
  (base + amplitude * Math.sin(Math.PI * progressAt(tick) * PEAK_SHIFT)) as Celsius;

/** Places the temperature peak around two-thirds through the shift. */
const PEAK_SHIFT = 0.75;

const clampRatio = (v: number): Ratio => Math.max(0, Math.min(1, v)) as Ratio;

/** Classify weather regime from temperature. */
function classifyKind(tempC: Celsius, wind: Ratio): WeatherKind {
  if (wind > 0.7) return 'Storm';
  if (tempC >= 38) return 'Heatwave';
  if (tempC <= 5) return 'Cold';
  return 'Clear';
}

// ---------------------------------------------------------------------------
// Public implementations
// ---------------------------------------------------------------------------

/** Seeded, deterministic weather model driven by a configurable arc. */
export class DeterministicWeatherModel implements IWeatherModel {
  private _state: WeatherState;
  private arc: WeatherArc;
  /** Ticks are the only clock here — the state is a pure function of tick. */
  private lastTick = 0;

  /**
   * The positional constructor is kept for the existing call sites and tests;
   * `setArc` is the path scenarios use.
   *
   * @param baseTemp Ambient baseline (°C). Default: 25 (clear/normal).
   */
  public constructor(
    baseTemp: Celsius = 25 as Celsius,
    heatAmplitude: Celsius = 0 as Celsius,
    windBase: Ratio = 0.3 as Ratio,
    irradianceBase: Ratio = 0.7 as Ratio,
    windGust = 0.2,
  ) {
    this.arc = {
      baseTempC: baseTemp,
      heatAmplitudeC: heatAmplitude,
      windBase,
      windGust,
      irradianceBase,
    };
    this._state = this._compute(0);
  }

  public current(): WeatherState {
    return this._state;
  }

  public advance(context: TickContext): WeatherState {
    this.lastTick = context.tick;
    this._state = this._compute(context.tick);
    return this._state;
  }

  public setArc(arc: WeatherArc): void {
    this.arc = arc;
    // Recompute immediately so `current()` never reports the previous
    // environment for the remainder of the tick that changed it.
    this._state = this._compute(this.lastTick);
  }

  private _compute(tick: number): WeatherState {
    const { baseTempC, heatAmplitudeC, irradianceBase, windBase, windGust } = this.arc;
    const temperature = heatwaveTemp(tick, baseTempC as Celsius, heatAmplitudeC as Celsius);
    // Irradiance follows the single afternoon→night arc, so the solar farm is
    // producing at the start of the shift and gone by the end of it.
    const irradiance = clampRatio(irradianceBase * daylightFactor(tick));
    // Wind drifts slowly across the shift rather than cycling every 30 s.
    const wind = clampRatio(windBase + windGust * Math.sin((2 * Math.PI * tick) / RUN_TICKS));
    const kind = classifyKind(temperature, wind);
    return { kind, temperature, irradiance, wind };
  }
}

/** Heatwave arc: starts at 32 °C and climbs past 43 °C into the evening. */
export class HeatwaveWeatherModel extends DeterministicWeatherModel {
  public constructor() {
    super(
      HEATWAVE_ARC.baseTempC as Celsius,
      HEATWAVE_ARC.heatAmplitudeC as Celsius,
      HEATWAVE_ARC.windBase as Ratio,
      HEATWAVE_ARC.irradianceBase as Ratio,
      HEATWAVE_ARC.windGust,
    );
  }
}

/** Storm arc: moderate temp, high wind, low irradiance. */
export class StormWeatherModel extends DeterministicWeatherModel {
  public constructor() {
    super(
      STORM_ARC.baseTempC as Celsius,
      STORM_ARC.heatAmplitudeC as Celsius,
      STORM_ARC.windBase as Ratio,
      STORM_ARC.irradianceBase as Ratio,
      STORM_ARC.windGust,
    );
  }
}

/** Cold snap: low temperature, low renewable output. */
export class ColdWeatherModel extends DeterministicWeatherModel {
  public constructor() {
    super(
      COLD_ARC.baseTempC as Celsius,
      COLD_ARC.heatAmplitudeC as Celsius,
      COLD_ARC.windBase as Ratio,
      COLD_ARC.irradianceBase as Ratio,
      COLD_ARC.windGust,
    );
  }
}
