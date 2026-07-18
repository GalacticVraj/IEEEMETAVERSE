import { createToken } from '@core';
import type { KernelEventMap, Token, TypedEventBus } from '@core';

import type { ReplayRecording } from '../model';

/**
 * Plays a recording back by re-emitting its events onto a bus in recorded
 * order, so every consumer (rendering, audio, UI) reacts to a replay exactly as
 * it did live — no special-casing required.
 */
export interface ReplayPlayer {
  load(recording: ReplayRecording): void;
  /** Re-emit the recorded events onto `bus`, in order. */
  play<TEvents extends KernelEventMap>(bus: TypedEventBus<TEvents>): void;
  readonly loaded: boolean;
}

export const REPLAY_PLAYER: Token<ReplayPlayer> = createToken('ReplayPlayer');

export function createReplayPlayer(): ReplayPlayer {
  let recording: ReplayRecording | null = null;

  return {
    get loaded(): boolean {
      return recording !== null;
    },
    load(next: ReplayRecording): void {
      recording = next;
    },
    play<TEvents extends KernelEventMap>(bus: TypedEventBus<TEvents>): void {
      if (recording === null) return;
      // Emit by name+payload; the recorded stream is the source of truth. The
      // cast keeps `bus` as the receiver so `this` binds correctly.
      const loose = bus as unknown as { emit(name: string, payload: unknown): void };
      for (const event of recording.events) {
        loose.emit(event.name, event.payload);
      }
    },
  };
}
