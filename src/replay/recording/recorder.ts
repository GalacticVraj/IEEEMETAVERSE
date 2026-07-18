import { createToken } from '@core';
import type { KernelEventMap, Token, TypedEventBus, Unsubscribe } from '@core';

import type { PlayerAction, RecordedEvent, ReplayCheckpoint, ReplayRecording } from '../model';

export interface ReplayRecorderStartOptions<TEvents extends KernelEventMap> {
  readonly seed: number;
  readonly version: string;
  readonly configHash: string;
  readonly bus: TypedEventBus<TEvents>;
}

/**
 * Captures a run into a {@link ReplayRecording} by subscribing to EVERY event
 * via the bus's `onAny` trace. Records the seed, config hash, event stream,
 * operator actions, and determinism checkpoints (snapshot hashes).
 */
export interface ReplayRecorder<TEvents extends KernelEventMap = KernelEventMap> {
  start(options: ReplayRecorderStartOptions<TEvents>): void;
  /** Record a determinism checkpoint (a snapshot hash at a tick). */
  checkpoint(tick: number, hash: string): void;
  /** Record an operator action for faithful re-simulation. */
  recordAction(action: PlayerAction): void;
  /** Stop and return the finished recording. */
  stop(tickCount: number): ReplayRecording;
  readonly recording: boolean;
}

export const REPLAY_RECORDER: Token<ReplayRecorder> = createToken('ReplayRecorder');

export function createReplayRecorder<
  TEvents extends KernelEventMap = KernelEventMap,
>(): ReplayRecorder<TEvents> {
  const events: RecordedEvent[] = [];
  const checkpoints: ReplayCheckpoint[] = [];
  const actions: PlayerAction[] = [];
  let unsubscribe: Unsubscribe | null = null;
  let seed = 0;
  let version = '';
  let configHash = '';
  let active = false;

  return {
    get recording(): boolean {
      return active;
    },
    start(options: ReplayRecorderStartOptions<TEvents>): void {
      seed = options.seed;
      version = options.version;
      configHash = options.configHash;
      events.length = 0;
      checkpoints.length = 0;
      actions.length = 0;
      active = true;
      unsubscribe = options.bus.onAny((envelope) => {
        events.push({
          tick: envelope.tick,
          seq: envelope.seq,
          name: String(envelope.name),
          payload: envelope.payload,
        });
      });
    },
    checkpoint(tick: number, hash: string): void {
      checkpoints.push({ tick, hash });
    },
    recordAction(action: PlayerAction): void {
      actions.push(action);
    },
    stop(tickCount: number): ReplayRecording {
      unsubscribe?.();
      unsubscribe = null;
      active = false;
      return {
        // Deterministic id (no wall-clock) so recordings are reproducible.
        recordingId: `replay-seed${seed}-ticks${tickCount}`,
        metadata: { version, configHash, seed, tickCount },
        events: [...events],
        actions: [...actions],
        checkpoints: [...checkpoints],
      };
    },
  };
}
