import { createToken, notImplemented } from '@core';
import type { GridEventBus, Token } from '@core';

import type { ReplayRecording } from '../model';

/**
 * Captures a run into a {@link ReplayRecording} by subscribing to the event bus.
 * Records the seed and every emitted event; periodically snapshots state.
 */
export interface IReplayRecorder {
  /** Begin recording from a fresh run with the given seed. */
  start(seed: number, bus: GridEventBus): void;
  /** Stop and return the finished recording. */
  stop(): ReplayRecording;
  readonly recording: boolean;
}

export const REPLAY_RECORDER: Token<IReplayRecorder> = createToken('ReplayRecorder');

/**
 * Placeholder replay recorder.
 *
 * PHASE 8 will subscribe to all events, append them with their tick, snapshot
 * state at intervals, and finalize a recording on stop.
 */
export class PlaceholderReplayRecorder implements IReplayRecorder {
  public readonly recording = false;

  public start(seed: number, bus: GridEventBus): void {
    notImplemented('ReplayRecorder.start', 'Subscribe to the bus and capture events + snapshots.', {
      seed,
      bus,
    });
  }

  public stop(): ReplayRecording {
    return notImplemented('ReplayRecorder.stop', 'Finalize and return the recording.');
  }
}
