import { createToken, notImplemented } from '@core';
import type { GridEventBus, Token } from '@core';

/**
 * System E facade. Composes adaptive music, ambient, SFX, and the mixer, and
 * subscribes to the event bus: simulation EMITS, audio REACTS. It reads events
 * only — it never drives or queries the simulation.
 */
export interface IAudioEngine {
  init(): void;
  /** Subscribe to the bus and map events → music/ambient/SFX. */
  attach(bus: GridEventBus): void;
  detach(): void;
  dispose(): void;
}

export const AUDIO_ENGINE: Token<IAudioEngine> = createToken('AudioEngine');

/**
 * Placeholder audio engine.
 *
 * PHASE 7 will map events to sound: severity → music intensity, weather →
 * ambient bed, line trips/cascade → SFX, with dynamic ducking.
 */
export class PlaceholderAudioEngine implements IAudioEngine {
  public init(): void {
    notImplemented('AudioEngine.init', 'Load Howler layers and prepare the mix graph.');
  }

  public attach(bus: GridEventBus): void {
    notImplemented('AudioEngine.attach', 'Subscribe to events and route them to audio.', { bus });
  }

  public detach(): void {
    notImplemented('AudioEngine.detach', 'Unsubscribe all audio listeners.');
  }

  public dispose(): void {
    notImplemented('AudioEngine.dispose', 'Unload all audio resources.');
  }
}
