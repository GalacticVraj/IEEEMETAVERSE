import type { Celsius, Ratio, WeatherKind } from '@app-types';
import { createToken, notImplemented } from '@core';
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

/**
 * Placeholder weather model.
 *
 * PHASE 2 will model a heatwave arc: a rising temperature curve (seeded, with
 * diurnal variation) that increases cooling load and, past a threshold, derates
 * thermal generation — emitting `WeatherChanged` as conditions shift.
 */
export class PlaceholderWeatherModel implements IWeatherModel {
  public current(): WeatherState {
    return notImplemented('WeatherModel.current', 'Return the current weather state.');
  }

  public advance(context: TickContext): WeatherState {
    return notImplemented(
      'WeatherModel.advance',
      'Advance the seeded heatwave curve and emit WeatherChanged on regime shifts.',
      { context },
    );
  }
}
