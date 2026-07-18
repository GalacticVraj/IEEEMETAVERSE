import type { GeneratorId, MegaWatts } from '@app-types';
import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

import type { GridTopology } from '../model/grid';
import type { WeatherState } from '../weather/weather';

export interface GenerationDispatch {
  readonly generator: GeneratorId;
  readonly output: MegaWatts;
}

/** Computes how much each generator is producing under current conditions. */
export interface IGenerationModel {
  dispatch(topology: GridTopology, weather: WeatherState): readonly GenerationDispatch[];
  totalOutput(): MegaWatts;
}

export const GENERATION_MODEL: Token<IGenerationModel> = createToken('GenerationModel');

/**
 * Placeholder generation model.
 *
 * PHASE 2 will dispatch baseload → renewables (weather-scaled) → peakers →
 * storage/import to meet demand, respecting capacities and heat derating, and
 * emit `GenerationChanged` when dispatch shifts.
 */
export class PlaceholderGenerationModel implements IGenerationModel {
  public dispatch(topology: GridTopology, weather: WeatherState): readonly GenerationDispatch[] {
    return notImplemented(
      'GenerationModel.dispatch',
      'Merit-order dispatch with weather-scaled renewables and thermal derating.',
      { topology, weather },
    );
  }

  public totalOutput(): MegaWatts {
    return notImplemented('GenerationModel.totalOutput', 'Sum current generator outputs.');
  }
}
