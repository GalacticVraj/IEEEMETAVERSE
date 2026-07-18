import { createToken, notImplemented } from '@core';
import type { GridEventBus, Token } from '@core';

import type { ReplayRecording } from '../model';

/**
 * Plays a recording back by re-emitting its events onto a bus in tick order,
 * so every consumer (rendering, audio, UI) reacts to a replay exactly as it did
 * live — no special-casing required.
 */
export interface IReplayPlayer {
  load(recording: ReplayRecording): void;
  /** Re-emit events onto `bus` at `speed`× real time. */
  play(bus: GridEventBus, speed: number): void;
  pause(): void;
  /** Jump to `tick` using the nearest prior snapshot. */
  seek(tick: number): void;
  readonly playing: boolean;
}

export const REPLAY_PLAYER: Token<IReplayPlayer> = createToken('ReplayPlayer');

/**
 * Placeholder replay player.
 *
 * PHASE 8 will drive playback with a scheduler that re-emits recorded events,
 * supporting pause, variable speed, and snapshot-assisted seeking. Emits
 * `ReplayStarted` / `ReplayFinished`.
 */
export class PlaceholderReplayPlayer implements IReplayPlayer {
  public readonly playing = false;

  public load(recording: ReplayRecording): void {
    notImplemented('ReplayPlayer.load', 'Index the recording for playback and seeking.', {
      recording,
    });
  }

  public play(bus: GridEventBus, speed: number): void {
    notImplemented('ReplayPlayer.play', 'Re-emit recorded events onto the bus at speed.', {
      bus,
      speed,
    });
  }

  public pause(): void {
    notImplemented('ReplayPlayer.pause', 'Halt playback, preserving position.');
  }

  public seek(tick: number): void {
    notImplemented('ReplayPlayer.seek', 'Restore nearest snapshot and fast-forward to tick.', {
      tick,
    });
  }
}
