import type { Ratio } from '@app-types';
import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

/** Dynamic mixing: master volume and ducking (e.g. duck music under a voice). */
export interface IAudioMixer {
  setMasterVolume(volume: Ratio): void;
  duck(target: 'music' | 'ambient', amount: Ratio): void;
}

export const AUDIO_MIXER: Token<IAudioMixer> = createToken('AudioMixer');

/** Placeholder mixer. PHASE 7 implements bus-level gain and ducking. */
export class PlaceholderAudioMixer implements IAudioMixer {
  public setMasterVolume(volume: Ratio): void {
    notImplemented('AudioMixer.setMasterVolume', 'Set master output gain.', { volume });
  }

  public duck(target: 'music' | 'ambient', amount: Ratio): void {
    notImplemented('AudioMixer.duck', 'Temporarily attenuate a bus for clarity.', {
      target,
      amount,
    });
  }
}
