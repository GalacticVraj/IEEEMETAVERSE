# GridGuard v3 — Phase 1 Foundation & Architecture Design

- **Date:** 2026-07-18
- **Status:** Approved (with modifications)
- **Scope:** Phase 1 only — project foundation, tooling, architecture, contracts, placeholders, documentation. **No simulation, rendering, or UI logic is implemented.**
- **Supersedes:** `README.md` (the 4-system "Master Build Prompt"), which is retained as an archived design reference under `docs/reference/`.

---

## 0. Governing philosophy (permanent, non-negotiable)

> **Simulation First. Rendering Second. UI Third.**

1. **The simulation is the single source of truth.** Rendering, UI, audio, replay, analytics, and any future AI systems are **consumers only**. They may never compute, infer, cache, or mutate authoritative simulation state.
2. **Every visual effect must have a traceable simulation cause.** No decorative or arbitrary animation. If a pixel moves, an event caused it.
3. **The visual language is frozen now.** Target a **premium engineering operations console** — SCADA systems, industrial control rooms, NASA Mission Control, high-end simulation software. **Forbidden:** generic AI dashboards, glassmorphism, neon cyberpunk, oversized rounded cards, decorative gradients.
4. **Engineering realism beats visual decoration** whenever the two conflict.
5. **Every future feature must strengthen at least one pillar:** engineering credibility · educational impact · simulation realism · memorable demo moments · judging evidence.

These five directives are the acceptance lens for all future phases and are duplicated into `docs/experience-doctrine.md` and `docs/competition-strategy.md`.

---

## 1. Layered architecture

Six systems (A–F) sit on a pure **kernel** and communicate exclusively through a typed event bus. A dedicated **Simulation Kernel** orchestrates System A. Projections mirror state read-only for consumers.

| Layer | Folder | Single responsibility | May import |
|---|---|---|---|
| Kernel primitives | `core/` | EventBus type, DI container, `Result`, branded IDs, RNG + Clock **contracts**, base interfaces | nothing (pure) |
| **Simulation Kernel** | `kernel/` | deterministic time, fixed-timestep scheduler, seeded RNG impl, lifecycle, event orchestration, **system registry**, **simulation FSM** | `core`, `utils`, `constants`, `types` |
| **A · Simulation** | `engine/` | topology, powerflow, cascade, protection, restoration, weather, generation, loads, director | `core`, `kernel`, `ethics`, `utils`, `constants`, `types` |
| Crisis scenarios (plugin) | `scenarios/` | `ICrisisScenario` contract + registry + scenario plugins | `core`, `engine`, `kernel`, `types` |
| **B · Learning** | `learning/` | Learner Twin, knowledge tracing, concept graph, reference policy, decision scoring, analytics | `core`, `ethics`, `utils`, `types` |
| Ethics (domain) | `ethics/` | EIA snapshot, calibration, equity — pure data | `core`, `utils`, `types` |
| **Replay** (first-class) | `replay/` | recording, playback, serialization, verification, timeline, snapshots | `core`, `kernel`, `types` |
| **C · Presentation** | `rendering/scene-graph/` · `rendering/visual-effects/` | scene graph (camera/lighting/world structure) vs. effects (particles/postFX/animation) | `core`, `state`, `types` — **never** `engine`/`kernel` |
| **D · UI** | `ui/` | HUD, panels, decision wheel, timeline, replay controls, settings, accessibility | `core`, `state`, `types` |
| **E · Audio** | `audio/` | adaptive music, ambient, SFX, voice, mixing | `core`, `state`, `types` |
| **F · Infrastructure** | `infrastructure/` | composition root, config loading, serialization, logging, bootstrap | everything (wiring only) |
| Projections | `state/` | Zustand read-models updated **by events only** | `core`, `types` |
| Support | `debug/` `config/` `workers/` `utils/` `constants/` `types/` `assets/` | as named | `core` (+ `types`) |

**Enforcement of "simulation compiles if React/Three/UI are deleted":**
1. **ESLint import-boundary rules** — `core`, `kernel`, `engine`, `scenarios`, `learning`, `ethics`, `replay` are forbidden from importing `react`, `three`, `@react-three/*`, or any `rendering`/`ui`/`audio`/`state` path. Violations fail CI.
2. **`tsconfig.engine.json`** — typechecks only the pure layers with no DOM/React libs; `pnpm typecheck:engine` proves standalone compilation.

**README concept mapping:** Advisor (LLM) → deferred `infrastructure` external-service adapter (not a core system). Ethics/EIA → `ethics`. Learner Twin → System B. Simulation → System A.

---

## 2. Simulation Kernel (new, first-class)

Owns everything that makes the simulation deterministic and orchestrated, independent of any domain physics:

- **SimClock** — fixed-timestep virtual time; wall-clock decoupled (enables replay + deterministic tests).
- **Scheduler** — advances registered systems in a defined order each tick.
- **RNG** — seeded `mulberry32`; identical seed + inputs ⇒ identical event stream.
- **Lifecycle** — `init → start → tick* → stop → dispose` for every registered system.
- **Event orchestration** — owns the single `EventBus<GridEventMap>` instance the kernel exposes to consumers.
- **System registry** — systems register themselves; the kernel knows nothing about their internals (open/closed).
- **Simulation FSM** — see §5.

---

## 3. Event system (the spine)

A single strongly-typed `EventBus<GridEventMap>` in `core`. Event names are a string-literal union in `constants/events.ts` (no anonymous names). Each payload is a documented interface. `emit`/`on`/`once`/`off` are generic: `on('LineTripped', h)` infers `h`'s payload.

Catalogued events (all typed): `SimulationTick`, `WeatherChanged`, `LoadChanged`, `GenerationChanged`, `PowerFlowSolved`, `LineOverloaded`, `LineTripStarted`, `LineTripped`, `LineCooling`, `LineRecovered`, `CascadeStarted`, `CascadeStep`, `CascadeEnded`, `ZonePowered`, `ZoneBlackout`, `DecisionRequested`, `DecisionCommitted`, `LearningUpdated`, `ReplayStarted`, `ReplayFinished`, `GameEnded`, plus `SimStateChanged` (FSM). **Simulation emits → rendering/audio/ui/state/replay/analytics subscribe. Zero polling.**

---

## 4. Determinism & state ownership

- Seeded PRNG + fixed-timestep clock ⇒ reproducible runs (backbone of replay + `>90%` deterministic engine tests).
- **Engine owns authoritative state** (plain data). `state/` Zustand stores are **projections** rebuilt from events. Rendering/UI read projections and never mutate or compute simulation state. This is the mechanical answer to "the renderer must never invent state," documented in `docs/architecture/renderer-purity.md`.

---

## 5. Formal simulation state machine

Typed FSM with an explicit transition table (implemented for real in Phase 1; fully unit-tested):

```
Boot → Loading → Calibration → Idle → Pre-Crisis → Crisis → Cascade → Recovery → After-Action → Replay → Reset
```

- Each state is a typed constant; transitions are validated against an allow-list (illegal transitions throw).
- Entering/leaving a state emits `SimStateChanged`.
- `Reset` returns to `Boot`. `Replay` is reachable from `After-Action`. `Cascade` is reachable from `Crisis`; `Recovery` from `Cascade` or `Crisis`.

---

## 6. Plugin crisis-scenario architecture

- `ICrisisScenario` contract: `id`, `metadata`, `setup(engine)`, `onTick(ctx)`, `triggers`, `teardown()`.
- `ScenarioRegistry` registers scenarios by id; the engine core references only the interface.
- Phase 1 ships one placeholder scenario (`heatwave`) implementing the contract as a documented stub.
- **New scenarios are added without modifying engine core.**

---

## 7. Confirmed decisions

| # | Decision | Choice |
|---|---|---|
| A | Package layout | Single package at repo root + lint boundaries + `tsconfig.engine.json` |
| B | Dependency injection | Hand-rolled tiny typed container (deterministic, testable) |
| C | Web Worker for sim | Worker **contract stubbed** now; sim runs main-thread in Phase 1 |
| D | LLM Advisor + EIA | Advisor = deferred infra adapter; Ethics/EIA = domain module |
| — | Package manager | pnpm |
| — | Project root | repo root (`IEEEMETAVERSE/`) |

---

## 8. Tooling

Vite + React 18 + strict TypeScript · Tailwind · Vitest + v8 coverage · ESLint (flat, type-checked, import boundaries) + Prettier · Husky + lint-staged · GitHub Actions CI. Path aliases for every module. Named exports only (no default exports unless a framework demands). Barrel `index.ts` per module. ES modules.

**Strict TS flags:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noImplicitReturns`, `verbatimModuleSyntax`, `isolatedModules`. No `any`, no implicit any, no magic numbers.

---

## 9. Documentation deliverables

**`docs/architecture/` (15 docs, Mermaid):** 1 high-level architecture · 2 folder structure · 3 dependency graph · 4 simulation data flow · 5 rendering data flow · 6 event architecture · 7 module interaction · 8 coding standards · 9 development roadmap · 10 risk analysis · 11 performance budget · 12 testing strategy · 13 state ownership · 14 initialization sequence · 15 shutdown sequence. Plus `renderer-purity.md`.

**`docs/design/` (permanent doctrine):** `typography.md` · `color.md` · `spacing.md` · `motion.md` · `camera.md` · `lighting.md` · `audio.md` · `interaction.md` · `visual-hierarchy.md` · `visual-language.md` (frozen language + anti-patterns) · `README.md`.

**Root docs:** `docs/experience-doctrine.md` · `docs/competition-strategy.md`.

**Per-folder READMEs:** every `src/*` folder states its single responsibility.

---

## 10. Ordered build plan (this session)

1. Commit this spec.
2. `package.json` + all tooling configs (tsconfig set, vite, vitest, eslint flat + boundaries, prettier, tailwind/postcss, husky, lint-staged, GitHub Actions).
3. Folder tree + per-folder READMEs + path aliases.
4. `core/`: Result, branded IDs, RNG + Clock contracts, EventBus + event map + event-name registry, DI container + tokens.
5. `kernel/`: SimClock impl, scheduler, RNG impl, lifecycle, system registry, **FSM** (real + tested).
6. `engine/` domain systems (interface + `NotImplementedError` placeholder each).
7. `scenarios/`: `ICrisisScenario` + registry + heatwave stub.
8. `learning/`, `ethics/` (interfaces + placeholders).
9. `replay/` (interfaces + placeholders; snapshot/serialization contracts).
10. `state/` projection stores; `debug/` overlay shell; `config/` profiles; `workers/` stub; `rendering/{scene-graph,visual-effects}`, `ui/`, `audio/` shells.
11. `infrastructure/`: composition root, config loader, logging, serialization, bootstrap; `App.tsx`/`main.tsx` minimal shell.
12. Unit tests: RNG determinism, EventBus typing/behavior, SimClock, DI container, FSM transitions.
13. 15 architecture docs + `docs/design/` doctrine + experience doctrine + competition strategy.
14. `pnpm install`; verify `typecheck`, `typecheck:engine`, `lint`, `test`, `build` all green.
15. Commit. Print **Architecture Review**.

**Explicitly NOT built:** power flow, cascade, city geometry, the 3D scene, real simulation logic — all placeholders with TSDoc describing future implementation.

---

## 11. Testing strategy (Phase 1 target)

Unit tests co-located as `*.test.ts`; shared fixtures/integration in `tests/`. Phase 1 proves the harness and covers the deterministic kernel (RNG, Clock, EventBus, DI, FSM). Coverage config sets a high floor for `core`/`kernel`; the `>90%` engine target is enforced as physics lands in later phases.
