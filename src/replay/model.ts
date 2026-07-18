/** A single event captured during a run, tagged with the tick and emit order. */
export interface RecordedEvent {
  readonly tick: number;
  readonly seq: number;
  readonly name: string;
  /** Serialization-safe payload (branded scalars are plain values on the wire). */
  readonly payload: unknown;
}

/** A hashed determinism checkpoint captured at a given tick. */
export interface ReplayCheckpoint {
  readonly tick: number;
  readonly hash: string;
}

/** An operator action captured for faithful re-simulation. */
export interface PlayerAction {
  readonly tick: number;
  readonly kind: string;
  readonly data: unknown;
}

/** Provenance for a recording — everything needed to reproduce and validate it. */
export interface ReplayMetadata {
  /** Simulation code version the recording was made against. */
  readonly version: string;
  /** Hash of the configuration used, to detect config drift on replay. */
  readonly configHash: string;
  readonly seed: number;
  readonly tickCount: number;
}

/**
 * A complete, replayable recording. Because the simulation is deterministic,
 * `seed` + `actions` is sufficient to reproduce a run exactly; the event stream
 * and checkpoint hashes let the verifier prove the reproduction is faithful.
 */
export interface ReplayRecording {
  readonly recordingId: string;
  readonly metadata: ReplayMetadata;
  readonly events: readonly RecordedEvent[];
  readonly actions: readonly PlayerAction[];
  readonly checkpoints: readonly ReplayCheckpoint[];
}
