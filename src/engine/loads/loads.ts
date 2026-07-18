import type { MegaWatts, ZoneId } from '@app-types';
import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

import type { GridTopology } from '../model/grid';
import type { WeatherState } from '../weather/weather';

export interface ZoneDemand {
  readonly zone: ZoneId;
  readonly demand: MegaWatts;
}

/** Computes electricity demand per zone under current conditions. */
export interface ILoadModel {
  demand(topology: GridTopology, weather: WeatherState): readonly ZoneDemand[];
  totalDemand(): MegaWatts;
}

export const LOAD_MODEL: Token<ILoadModel> = createToken('LoadModel');

/**
 * Placeholder load model.
 *
 * PHASE 2 will compute per-zone demand from a base profile plus
 * temperature-driven cooling load (the heatwave lever), EV charging, and
 * operator-controlled sheddable blocks — emitting `LoadChanged` as demand moves.
 */
export class PlaceholderLoadModel implements ILoadModel {
  public demand(topology: GridTopology, weather: WeatherState): readonly ZoneDemand[] {
    return notImplemented(
      'LoadModel.demand',
      'Temperature-driven per-zone demand with sheddable blocks.',
      { topology, weather },
    );
  }

  public totalDemand(): MegaWatts {
    return notImplemented('LoadModel.totalDemand', 'Sum current per-zone demand.');
  }
}
