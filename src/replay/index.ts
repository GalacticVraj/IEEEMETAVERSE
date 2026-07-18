/**
 * `@replay` — a first-class module for deterministic recording and playback.
 * Recording (via the bus's `onAny` trace), playback (re-emitting events),
 * serialization, verification (diffing two runs to detect any divergence),
 * timeline, and snapshot storage. Relies on the kernel's determinism and
 * snapshot hashing; imports `@core` and `@kernel`, never a consumer layer.
 */
export * from './model';
export * from './recording/recorder';
export * from './playback/player';
export * from './serialization/json-backend';
export * from './serialization/replay-serializer';
export * from './verification/replay-verifier';
export * from './timeline/timeline';
export * from './snapshots/snapshot-store';
