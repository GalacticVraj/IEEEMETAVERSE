import type { Seconds, SnapshotId } from '@app-types';
import type { GridEventName } from '@constants';

/** A single event captured during a run, tagged with the tick it occurred on. */
export interface RecordedEvent {
  readonly tick: number;
  readonly name: GridEventName;
  /** Serialization-safe payload (branded scalars are plain values on the wire). */
  readonly payload: unknown;
}

/** A full serialized grid-state checkpoint, used for fast seeking. */
export interface Snapshot {
  readonly id: SnapshotId;
  readonly tick: number;
  /** Opaque serialized authoritative state. */
  readonly state: unknown;
}

/**
 * A complete, replayable recording. Because the simulation is deterministic,
 * `seed` + the event stream is sufficient to reproduce a run exactly;
 * `snapshots` merely make seeking fast.
 */
export interface ReplayRecording {
  readonly recordingId: string;
  readonly seed: number;
  readonly events: readonly RecordedEvent[];
  readonly snapshots: readonly Snapshot[];
  readonly duration: Seconds;
}
