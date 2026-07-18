import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

/** One-shot sound effects (transformer spark, breaker trip, alarm). */
export interface ISfxPlayer {
  play(cue: string): void;
}

export const SFX_PLAYER: Token<ISfxPlayer> = createToken('SfxPlayer');

/** Placeholder SFX player. PHASE 7 maps event cues to Howler one-shots. */
export class PlaceholderSfxPlayer implements ISfxPlayer {
  public play(cue: string): void {
    notImplemented('SfxPlayer.play', 'Play a one-shot SFX cue.', { cue });
  }
}
