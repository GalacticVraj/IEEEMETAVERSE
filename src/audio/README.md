# `audio/` — `@audio`

**System E, the Audio Engine.** Adaptive music, ambient beds, SFX, and dynamic mixing behind an `AudioEngine` facade. A **consumer**: the simulation emits events and audio _reacts_ to them (severity rises → music intensifies, a line trips → an SFX fires). It never drives, polls, or queries the simulation. Phase 1 provides the facade and layer interfaces as placeholders.

**May import:** `@core`, `@state`, `@app-types`, and the audio framework (`howler`).
**Must not import:** `@engine` or `@kernel`, `@scenarios`, `@learning`, `@ethics`, `@replay`.

**Key files**

- `audio-engine.ts` — the `AudioEngine` facade.
- `music/adaptive-music.ts` — severity-driven adaptive music.
- `ambient/ambient-layer.ts` — ambient beds.
- `sfx/sfx-player.ts` — event-triggered sound effects.
- `mixing/mixer.ts` — dynamic mixing/ducking.

**Phase 1:** **Placeholder** — facade + `NotImplementedError` stubs.
