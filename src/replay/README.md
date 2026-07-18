# `replay/` — `@replay`

**First-class deterministic replay.** Because the kernel is deterministic (seeded RNG + fixed-timestep clock), a run is fully reproducible from its `seed` plus its recorded event stream; snapshots merely make seeking fast. This module records every event during a run (via the bus's `onAny` trace), plays them back, serializes/deserializes recordings, and **verifies** that a re-simulation reproduces the original event stream and checkpoint hashes — reporting the first divergence. Playback re-emits recorded events onto a bus, so consumers cannot tell live from replayed events. It relies on the kernel's determinism but never imports the engine.

**May import:** `@core`, `@kernel`, `@constants`, `@app-types`, `@utils`.
**Must not import:** `@engine`, `@scenarios`, any consumer (`rendering`/`ui`/`audio`/`state`/`debug`/`infra`/`config`), or any framework.

**Key files**

- `model.ts` — `RecordedEvent`, `ReplayCheckpoint`, `PlayerAction`, `ReplayMetadata`, `ReplayRecording`.
- `recording/recorder.ts` — `createReplayRecorder` (records events + checkpoints + metadata).
- `playback/player.ts` — `createReplayPlayer` (re-emits recorded events).
- `serialization/replay-serializer.ts` + `serialization/json-backend.ts` — pluggable encoding (pure JSON backend).
- `verification/replay-verifier.ts` — `createReplayVerifier` (diffs two runs, detects divergence).
- `snapshots/snapshot-store.ts` — `createSnapshotStore` (tick-ordered `KernelSnapshot` store).
- `timeline/timeline.ts` — scrubber markers (still a placeholder).

**Ready** — recorder, player, serializer, verifier, and snapshot store are real and integration-tested (`replay.test.ts`). See `docs/kernel/08-replay-pipeline.md`.
