import type { Severity } from '@app-types';
import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

/**
 * Layered adaptive score. Crossfades music beds by tension so the soundtrack
 * escalates with the crisis — driven by the director's severity, never by a
 * fixed timeline.
 */
export interface IAdaptiveMusic {
  setIntensity(severity: Severity): void;
  stop(): void;
}

export const ADAPTIVE_MUSIC: Token<IAdaptiveMusic> = createToken('AdaptiveMusic');

/** Placeholder adaptive music. PHASE 7 crossfades Howler layers by tension. */
export class PlaceholderAdaptiveMusic implements IAdaptiveMusic {
  public setIntensity(severity: Severity): void {
    notImplemented('AdaptiveMusic.setIntensity', 'Crossfade music beds to match severity.', {
      severity,
    });
  }

  public stop(): void {
    notImplemented('AdaptiveMusic.stop', 'Fade out and stop all music layers.');
  }
}
