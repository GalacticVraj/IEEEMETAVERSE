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

/** Drives environmental conditions that push demand and renewable output. */
export interface IWeatherModel {
  current(): WeatherState;
  /** Advance the weather one tick and return the new state. */
  advance(context: TickContext): WeatherState;
}

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

  /** @param baseTemp   Ambient baseline (°C). Default: 25 (clear/normal). */
  public constructor(
    private readonly baseTemp: Celsius = 25 as Celsius,
    private readonly heatAmplitude: Celsius = 0 as Celsius,
    private readonly windBase: Ratio = 0.3 as Ratio,
    private readonly irradianceBase: Ratio = 0.7 as Ratio,
  ) {
    this._state = this._compute(0);
  }

  public current(): WeatherState {
    return this._state;
  }

  public advance(context: TickContext): WeatherState {
    this._state = this._compute(context.tick);
    return this._state;
  }

  private _compute(tick: number): WeatherState {
    const temperature = heatwaveTemp(tick, this.baseTemp, this.heatAmplitude);
    // Irradiance follows the single afternoon→night arc, so the solar farm is
    // producing at the start of the shift and gone by the end of it.
    const irradiance = clampRatio(this.irradianceBase * daylightFactor(tick));
    // Wind varies slowly with a secondary sine.
    // Wind drifts slowly across the shift rather than cycling every 30 s.
    const wind = clampRatio(this.windBase + 0.2 * Math.sin((2 * Math.PI * tick) / RUN_TICKS));
    const kind = classifyKind(temperature, wind);
    return { kind, temperature, irradiance, wind };
  }
}

/** Heatwave arc: starts at 32°C, peaks at 43°C over 200 ticks. */
export class HeatwaveWeatherModel extends DeterministicWeatherModel {
  public constructor() {
    super(32 as Celsius, 11 as Celsius, 0.15 as Ratio, 0.6 as Ratio);
  }
}

/** Storm arc: moderate temp, high wind, low irradiance. */
export class StormWeatherModel extends DeterministicWeatherModel {
  public constructor() {
    super(18 as Celsius, 0 as Celsius, 0.85 as Ratio, 0.15 as Ratio);
  }
}

/** Cold snap: low temperature, low renewable output. */
export class ColdWeatherModel extends DeterministicWeatherModel {
  public constructor() {
    super(2 as Celsius, 0 as Celsius, 0.1 as Ratio, 0.3 as Ratio);
  }
}
