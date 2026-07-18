# GridGuard

**An immersive, browser-based smart-grid crisis simulator.** Stand over a living
coastal city on the day a record heatwave hits, and hold the grid together as an
operator — every window's glow is real telemetry from an underlying electrical
simulation.

> **Simulation First. Rendering Second. UI Third.**
> The simulation engine is the product. Everything else visualizes it.

This repository currently contains the **Phase 1 foundation**: the full software
architecture, tooling, typed contracts, event system, dependency injection, and
placeholder modules for every subsystem. No simulation, rendering, or UI logic is
implemented yet — those arrive in later phases, plugging into the seams built here.

---

## Status

| Area                                                                      | State                    |
| ------------------------------------------------------------------------- | ------------------------ |
| Tooling (Vite, strict TS, ESLint boundaries, Prettier, Vitest, Husky, CI) | ✅ Ready                 |
| Simulation Kernel (time, seeded RNG, scheduler, registry, lifecycle, FSM) | ✅ Ready + tested        |
| Typed event bus + full event catalogue                                    | ✅ Ready + tested        |
| DI container + composition root                                           | ✅ Ready + tested        |
| Config profiles, projections, scenario registry                           | ✅ Ready                 |
| Simulation Engine (power flow, cascade, weather, …)                       | 🟡 Placeholder contracts |
| Learning, Ethics, Replay, Rendering, UI, Audio                            | 🟡 Placeholder contracts |

`main`-branch CI runs on every push: `typecheck`, `typecheck:engine`, `lint`,
`format:check`, `test`, `build`.

---

## Architecture at a glance

Six independent systems sit on a pure **kernel** and communicate exclusively
through a strongly-typed event bus. The simulation is the single source of truth;
rendering, UI, audio, and replay are pure **consumers**.

| System                 | Folder               | Responsibility                                                                               |
| ---------------------- | -------------------- | -------------------------------------------------------------------------------------------- |
| Simulation Kernel      | `src/kernel`         | Deterministic time, seeded RNG, scheduler, lifecycle, system registry, state machine         |
| **A** · Simulation     | `src/engine`         | Topology, power flow, cascade, protection, restoration, weather, generation, loads, director |
| **B** · Learning       | `src/learning`       | Learner Twin, knowledge tracing, concept graph, reference policy, scoring, analytics         |
| **C** · Presentation   | `src/rendering`      | Scene graph + visual effects (a pure consumer of simulation state)                           |
| **D** · User Interface | `src/ui`             | HUD, decision wheel, timeline, replay controls, settings, accessibility                      |
| **E** · Audio          | `src/audio`          | Adaptive music, ambient, SFX, dynamic mixing                                                 |
| **F** · Infrastructure | `src/infrastructure` | DI composition root, config, serialization, logging, bootstrap                               |

Plus first-class `src/replay` (record/verify/playback), `src/scenarios` (plugin
crisis architecture), and the `src/ethics` domain module (EIA calibration, equity).

**Why it's built this way:** the pure layers (`core`, `kernel`, `engine`, …) may
not import React, Three.js, or any UI code — enforced by ESLint import boundaries
**and** a dedicated `tsconfig.engine.json`. Run `pnpm typecheck:engine` and the
simulation provably compiles with the renderer, UI, and React deleted.

Full documentation lives in [`docs/`](./docs):

- [`docs/architecture/`](./docs/architecture) — 15 architecture documents (diagrams, data flow, events, roadmap, risks, testing, sequences) + the renderer-purity doctrine.
- [`docs/design/`](./docs/design) — the permanent, frozen design doctrine (typography, color, spacing, motion, camera, lighting, audio, interaction, hierarchy).
- [`docs/experience-doctrine.md`](./docs/experience-doctrine.md) — the project's identity and north star.
- [`docs/competition-strategy.md`](./docs/competition-strategy.md) — keeping development aligned with judging priorities.
- [`docs/reference/`](./docs/reference) — the original v1 master build prompt, kept for reference.

---

## Getting started

Requires **Node 20+** and **pnpm 9+** (`corepack enable pnpm`, or `npm i -g pnpm`).

```bash
pnpm install        # install dependencies
pnpm dev            # start the dev server (http://localhost:5173)
pnpm validate       # typecheck + typecheck:engine + lint + test
pnpm build          # production build
```

| Script                              | Purpose                                                    |
| ----------------------------------- | ---------------------------------------------------------- |
| `pnpm dev`                          | Vite dev server                                            |
| `pnpm build`                        | Typecheck, then production build                           |
| `pnpm typecheck`                    | Full-project type check                                    |
| `pnpm typecheck:engine`             | Prove the pure simulation layers compile with no DOM/React |
| `pnpm lint`                         | ESLint, including architectural boundary rules             |
| `pnpm test` / `pnpm test:coverage`  | Vitest                                                     |
| `pnpm format` / `pnpm format:check` | Prettier                                                   |

---

## Design philosophy

- **The simulation is the single source of truth.** Consumers never compute, infer, cache, or mutate authoritative state.
- **Every visual effect has a traceable simulation cause.** No decorative animation.
- **Frozen visual language:** a premium engineering operations console (SCADA, industrial control rooms, Mission Control). No glassmorphism, neon, oversized cards, or decorative gradients.
- **Engineering realism over decoration**, always.
- **Every feature must strengthen at least one pillar:** engineering credibility · educational impact · simulation realism · memorable demo moments · judging evidence.

---

## License

Private hackathon project. All rights reserved (for now).
