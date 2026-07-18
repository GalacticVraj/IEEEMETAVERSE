# `replay/` — `@replay`

**First-class deterministic replay.** Because the kernel is deterministic (seeded RNG + fixed-timestep clock), a run is fully reproducible from its `seed` plus its recorded event stream; snapshots merely make seeking fast. This module records events during a run, plays them back, serializes/deserializes recordings, verifies that a replay reproduces the original event stream, drives a scrub timeline, and stores state snapshots. It subscribes to the bus and **re-emits recorded events onto it** during playback; consumers cannot tell live from replayed events. It relies on the engine's determinism but never imports the engine.

**May import:** `@core`, `@kernel`, `@constants`, `@app-types`, `@utils`.
**Must not import:** `@engine`, `@scenarios`, any consumer (`rendering`/`ui`/`audio`/`state`/`debug`/`infra`/`config`), or any framework.

**Key files**

- `model.ts` — `RecordedEvent`, `Snapshot`, `ReplayRecording`.
- `recording/recorder.ts`, `playback/player.ts`.
- `serialization/replay-serializer.ts`, `verification/replay-verifier.ts`.
- `timeline/timeline.ts`, `snapshots/snapshot-store.ts`.

**Phase 1:** **Placeholder** — contracts + `NotImplementedError` stubs; the determinism they depend on is already real in `@kernel`.
