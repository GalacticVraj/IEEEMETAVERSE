# Visual Language — FROZEN

The definitive statement of what GridGuard looks and feels like. Everything else in this directory serves this document.

---

## The target feel

**A premium engineering operations console.** The room is calm, dark, and dense with instruments. It is quiet when the grid is healthy and it escalates — deliberately, legibly — only when the simulation says something is wrong. Nothing on screen is there to impress; everything is there to inform. The operator (player) reads state at a glance, acts, and watches consequences propagate.

Three words hold the whole language together:

> **Restraint. Precision. Calm-until-crisis.**

| Attribute | We are                                              | We are not                             |
| --------- | --------------------------------------------------- | -------------------------------------- |
| Density   | Dense but legible — instruments packed with purpose | Sparse marketing hero panels           |
| Chroma    | Graphite surfaces, color reserved for meaning       | Saturated, colorful, "vibrant"         |
| Motion    | Still until an event fires                          | Ambiently animated, always breathing   |
| Geometry  | Hairlines, 2–4px radii, tight grids                 | Big soft rounded cards, floating pills |
| Tone      | Serious simulation software                         | Playful consumer app                   |

---

## The core rule: every effect has a simulation cause

This is non-negotiable and it governs color, motion, camera, lighting, and audio alike.

> **If a pixel moves, changes color, brightens, or makes a sound, a simulation event caused it — and you can name the event.**

The simulation is the single source of truth. Rendering, UI, audio, and effects are **consumers only**; they may never invent, infer, or cache authoritative state, and they may never animate for their own sake. Practical test for any effect you propose:

1. **Name the event.** Which catalogued simulation event (`LineOverloaded`, `LineTripped`, `CascadeStep`, `ZoneBlackout`, `WeatherChanged`, …) triggers this?
2. **If you cannot name it, delete the effect.** "It looks nice" is not a cause.

Traceability is the difference between an engineering console and a screensaver.

---

## FORBIDDEN — and why

These are banned outright. Not "use sparingly" — banned. Each undermines the credibility the product depends on.

| Forbidden                                                                | Why it is banned                                                                                                                                |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Generic AI dashboards**                                                | Reads as a template, not a simulator. Destroys engineering credibility — the pillar the whole product rests on.                                 |
| **Glassmorphism** (frosted blur, translucent floating panels)            | Trendy, decorative, low-legibility. Blur over a busy 3D scene wrecks readability of dense telemetry. Real control rooms are opaque and solid.   |
| **Neon / cyberpunk** (glow, saturated magenta/cyan, dark-synth palettes) | Signals game-toy, not instrument. Steals the semantic meaning of color — if everything glows, nothing means anything.                           |
| **Oversized rounded cards**                                              | Consumer-app language. Wastes density, breaks the instrument-panel metaphor. Our radii are 2px / 4px for a reason.                              |
| **Decorative gradients**                                                 | A gradient implies a value ramp. Using one for decoration lies about the data. Surfaces are flat; the only ramps allowed encode real magnitude. |
| **Purely decorative animation**                                          | Violates the simulation-cause rule. Idle motion competes with event-driven motion for attention and dilutes crisis signals.                     |

When a design instinct pulls toward any of the above, it is the instinct to correct — not the doctrine.

---

## Reference touchstones

Aim here. When a decision is ambiguous, ask "what would this look like in Mission Control?"

| Touchstone                                                             | What we borrow                                                                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **SCADA / HMI systems** (industrial supervisory control)               | Semantic status colors, mimic-diagram thinking, alarm discipline, dense tabular readouts, hairline schematics |
| **NASA / JPL Mission Control**                                         | Calm authority, monospaced telemetry walls, restraint under pressure, "nominal" as the resting state          |
| **Industrial control rooms** (power plants, refineries)                | Graphite consoles, physical-panel layout, information density, alarm escalation that means something          |
| **High-end simulation software** (flight sims, EMS/DMS, digital twins) | Realism over polish, instrument fidelity, trust through accuracy                                              |

**Anti-touchstones** (what to steer away from): crypto/AI SaaS landing pages, mobile fitness apps, sci-fi movie "hacker" UIs, dribbble hero shots.

---

## The escalation principle

The interface has a resting state and a crisis state, and the distance between them is the drama.

- **Calm:** predominantly `status.nominal`, still, quiet, low luminance range. The console looks bored — as it should when the grid is healthy.
- **Crisis:** semantic colors climb the ladder (caution → warning → critical), event-driven motion and audio activate, the camera and lighting respond. Because calm was genuinely quiet, escalation reads instantly.

If the calm state is noisy or decorated, the crisis state has nowhere to go. **Protect the calm.**

---

## The two acceptance lenses

Every visual proposal passes both or it does not ship:

1. **Simulation cause** — can you name the event that drives it?
2. **Pillar strength** — does it strengthen ≥1 of: engineering credibility · educational impact · simulation realism · memorable demo moments · judging evidence?
