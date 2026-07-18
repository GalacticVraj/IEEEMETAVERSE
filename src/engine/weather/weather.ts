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

/** Normalised sine-based heatwave arc: temperature rises over ~200 ticks. */
const heatwaveTemp = (tick: number, base: Celsius, amplitude: Celsius): Celsius =>
  (base + amplitude * Math.sin((Math.PI * tick) / 200)) as Celsius;

const clampRatio = (v: number): Ratio => (Math.max(0, Math.min(1, v)) as Ratio);

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
    // Diurnal irradiance variation: peaks at midday (tick 50 of 100-tick day).
    const dayPhase = (tick % 100) / 100;
    const irradiance = clampRatio(
      this.irradianceBase * Math.sin(Math.PI * dayPhase),
    );
    // Wind varies slowly with a secondary sine.
    const wind = clampRatio(
      this.windBase + 0.2 * Math.sin((2 * Math.PI * tick) / 300),
    );
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
