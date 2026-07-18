import type { WeatherKind } from '@app-types';
import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

/** The environmental sound bed (city hum, wind), tied to weather. */
export interface IAmbientLayer {
  set(kind: WeatherKind): void;
  stop(): void;
}

export const AMBIENT_LAYER: Token<IAmbientLayer> = createToken('AmbientLayer');

/** Placeholder ambient layer. PHASE 7 crossfades ambience by weather regime. */
export class PlaceholderAmbientLayer implements IAmbientLayer {
  public set(kind: WeatherKind): void {
    notImplemented('AmbientLayer.set', 'Crossfade the ambient bed to the weather regime.', {
      kind,
    });
  }

  public stop(): void {
    notImplemented('AmbientLayer.stop', 'Fade out the ambient bed.');
  }
}
