# GridGuard — Design Doctrine

**Status: FROZEN (permanent).** This directory is the single source of truth for GridGuard's visual and interaction language. It is a doctrine, not a suggestion. Future work either conforms to it or amends it here first — never in isolation.

GridGuard is a browser-based smart-grid crisis simulator. Its interface is a **premium engineering operations console** — the surface of a system that models real power-grid physics, not a dashboard that decorates data.

---

## The frozen visual language (one paragraph)

A calm, dense, graphite control room that stays quiet until the grid is in trouble. Low-chroma surfaces, monospaced telemetry, hairline dividers, restrained radii. Color is **semantic** — every status hue maps to a defined simulation condition and nothing else. Motion, light, and sound exist only as consequences of simulation events. The reference points are SCADA HMIs, NASA Mission Control, and high-end industrial simulators. The forbidden zone is generic AI dashboards, glassmorphism, neon cyberpunk, oversized rounded cards, and decorative gradients.

> **Every visual effect must have a traceable simulation cause. If a pixel moves, an event caused it.**

---

## The five feature-value pillars

Every feature must strengthen **at least one**. A feature that strengthens none does not ship.

| #   | Pillar                      | Test question                                                       |
| --- | --------------------------- | ------------------------------------------------------------------- |
| 1   | **Engineering credibility** | Would a power-systems engineer trust this?                          |
| 2   | **Educational impact**      | Does the learner understand the grid better afterward?              |
| 3   | **Simulation realism**      | Does it reflect authoritative simulation state, not invented state? |
| 4   | **Memorable demo moments**  | Does it create a moment judges remember?                            |
| 5   | **Judging evidence**        | Does it produce visible proof of depth for scoring?                 |

---

## The documents

| Doc                                            | Governs                                                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [`visual-language.md`](./visual-language.md)   | Target feel, the FORBIDDEN list (with reasons), reference touchstones, the simulation-cause rule    |
| [`color.md`](./color.md)                       | Full palette, semantic status mapping, contrast, no-gradient / low-chroma / never-color-alone rules |
| [`typography.md`](./typography.md)             | Mono vs sans, tabular telemetry, scale, weights, uppercase tracking, restraint                      |
| [`spacing.md`](./spacing.md)                   | Spacing scale, instrument density, hairline borders, grid gaps, panel padding                       |
| [`motion.md`](./motion.md)                     | Event-driven motion only, GSAP for cinematics, easing/duration, no idle animation                   |
| [`camera.md`](./camera.md)                     | Orbit + director-fired cinematic tweens, Meridian Bay framing, readability                          |
| [`lighting.md`](./lighting.md)                 | Key/fill/ambient, load-reactive emissive, day/night + blackout, capped postprocessing               |
| [`audio.md`](./audio.md)                       | Adaptive music by tension, ambient by weather, event SFX, ducking, audio-follows-sim                |
| [`interaction.md`](./interaction.md)           | Decision Wheel, zone selection, HUD affordances, pointer-events discipline                          |
| [`visual-hierarchy.md`](./visual-hierarchy.md) | Reading order, emphasis, calm vs crisis focus                                                       |

---

## How to use this doctrine

1. **Before designing or building any UI, camera, effect, or sound**, read the relevant doc here.
2. **Match the code.** Tokens are defined in [`tailwind.config.js`](../../tailwind.config.js) and mirrored in [`color.md`](./color.md). Use the token names — never raw hex in components.
3. **Run the two lenses** on every proposal:
   - Does every visual effect trace to a simulation cause? (If not, cut it.)
   - Does it strengthen ≥1 of the five pillars? (If not, cut it.)
4. **When in conflict, engineering realism wins** over visual decoration — always.
5. **To change the language, change this doctrine first.** No ad-hoc deviations. The point of freezing is coherence across every future phase.

---

## Related governing docs

- [`../superpowers/specs/2026-07-18-gridguard-v3-foundation-design.md`](../superpowers/specs/2026-07-18-gridguard-v3-foundation-design.md) — Phase 1 foundation & governing philosophy (_Simulation First. Rendering Second. UI Third._)
- `../experience-doctrine.md` and `../competition-strategy.md` — where the five directives are duplicated as the acceptance lens.
