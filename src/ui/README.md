# `ui/` — `@ui`

**System D, the User Interface.** The app shell plus the HUD, decision wheel, timeline bar, replay controls, settings panel, accessibility helpers, and the Phase-1 foundation status screen. A **consumer**: it reads simulation/learning/UI projections from `@state` and, in response to operator action, **emits intents (events) onto the bus** — it never owns or computes simulation state. Styled in the frozen "premium engineering operations console" visual language (control-room graphite, instrument accents).

**May import:** `@core`, `@state`, `@app-types`, and `react`.
**Must not import:** `@engine` or `@kernel` (enforced by ESLint), `@scenarios`, `@learning`, `@ethics`, `@replay`.

**Key files**

- `app-shell.tsx` — top-level UI composition.
- `foundation/foundation-screen.tsx` — Phase-1 verification console (per-system Ready/Placeholder status).
- `hud/hud.tsx`, `decision-wheel/decision-wheel.tsx`, `timeline/timeline-bar.tsx`, `replay-controls/replay-controls.tsx`, `settings/settings-panel.tsx`.
- `accessibility/a11y.ts` — accessibility helpers.

**Phase 1:** `FoundationScreen` is a **Ready** real surface; the gameplay UI (HUD, decision wheel, timeline, replay controls, settings) are **Placeholder** shells.
