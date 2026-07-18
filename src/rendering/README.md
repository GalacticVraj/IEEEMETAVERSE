# `rendering/` — `@rendering`

**System C, Presentation.** Deliberately split into `scene-graph` (structural world — city geometry, camera rig, lighting) and `visual-effects` (post-processing, particles, event-triggered animation) so the layer never becomes a monolith, with `render-root` composing both. It is a **PURE CONSUMER**: it reads simulation projections from `@state` and reacts to events on the bus. It may never compute, infer, cache, or mutate authoritative simulation state — every visual effect must trace to a simulation event. This is what lets the simulation compile if rendering is deleted.

**May import:** `@core`, `@state`, `@app-types`, and rendering frameworks (`react`, `three`, `@react-three/*`, `gsap`).
**Must not import:** `@engine` or `@kernel` (enforced by ESLint), `@scenarios`, `@learning`, `@ethics`, `@replay`.

**Key files**

- `render-root.tsx` — `RenderRoot`, composes the presentation pieces (later wraps an r3f `<Canvas>`).
- `scene-graph/scene-graph.tsx` — `SceneGraph`, `CameraRig`, `Lighting`.
- `visual-effects/effects-pipeline.tsx` — `EffectsPipeline` (postFX/particles/animation).

**Phase 1:** **Placeholder** — empty composed shells; no 3D scene mounted yet.
