# GridGuard v3 — Experience Foundation Design (§1 + §2)

Date: 2026-07-22
Branch: `feature/experience-foundation`
Status: §1 approved by user · §2 authored by user (spec below is the consolidated record)

## Goal

Transform the presentation layer from prototype/game feel into a **premium daylight
smart-city digital twin with a mission-control learning interface**. The user is a
student acting as _"Grid Operator protecting Meridian Bay during a climate crisis."_
The interface must teach, not just display data.

Feel like: SimCity + NASA Mission Control + smart-city digital twin.
Not like: cartoon game, developer demo, dark hacker dashboard, generic AI UI.

## Frozen (must not modify)

Simulation Kernel (`src/kernel`) · Electrical Graph (`src/engine/graph`) ·
DC Power Flow (`src/engine/powerflow`) · Protection Engine (`src/engine/protection`)
· Scenario framework (`src/scenarios/crisis-scenario.ts`, registry, plugins) ·
all deterministic simulation logic. `main` branch receives no direct commits.

Wiring in `src/infrastructure` (bootstrap, composition-root) and **new adapter
files** are allowed — they connect frozen modules without changing them.

---

## §1a Visual language — "Daylight digital twin, mission-control overlay"

Two deliberately contrasted registers:

**The world (3D viewport):** warm daylight Meridian Bay — soft sun, light
atmospheric haze, muted-realistic architecture palette (limestone, terracotta,
concrete, glass), green parks, blue water. Premium maquette, restrained saturation.

**The interface (overlays):** neutral professional surfaces — light-warm gray
panels, high-contrast ink. NOT black, NOT glass. Subtle depth: 1px borders +
faint elevation. 2–4px radii. Inter for prose, monospace for values/IDs
(tabular numerals). 10–12px uppercase tracked micro-labels for panel headers.
No emoji, no icon fonts, no gradients, no glassmorphism, no neon, no glow.

**Semantic color only:** amber = stressed/warning · red = critical · dark gray =
offline · green = recovering/nominal-good · cyan reserved for selection/focus.
Zero decorative color in the UI layer.

**Time-of-day as narrative:** scenarios traverse a day arc (morning briefing →
afternoon heat peak → dusk crisis → night blackout → dawn recovery), driven by
simulation tick + weather state. This makes blackouts legible in a daylight
world and gives the heatwave a visible atmosphere. (Full implementation of the
sky/lighting arc belongs to §3; §2 only requires the hooks to exist.)

**Learning-first copy register:** every telemetry value pairs with a
plain-language cause line — `L-DT-HB · 87%` reads "High demand is stressing
this downtown corridor." Numbers stay for credibility; sentences teach.

## §1b Simulation ignition (approved; adapters/wiring only)

The engine stack is fully implemented and tested but unwired; the live app
currently ticks an empty kernel. Fixes (no frozen-module edits):

1. **Topology→graph builder** — new adapter `buildGraphFromTopology(MERIDIAN_BAY_TOPOLOGY)`
   populates `ELECTRICAL_GRAPH` in one `graph.mutate` transaction at bootstrap
   (20 buses, 30 lines, 8 generators, 18 loads, breakers).
2. **`kernel.register(engine)`** before `kernel.boot()` in `bootstrap.ts`.
3. **Protection bridge** — construct protection engine _with_ the domain bus;
   new translator maps `BreakerOpened/BreakerClosed` → domain
   `LineTripped/LineRecovered` (with cause), feeding cascade engine, grid-store,
   and the event stream.
4. **SimulationTick dedupe** — the engine's rich domain `SimulationTick` is the
   one stores consume; the kernel's internal tick stays internal.
5. **Tick driver** — moved out of OperatorPanel's `setInterval` into a runtime
   service started/stopped by app-flow transitions. Crisis end conditions move
   to the director (emits `CrisisEnded`) instead of UI-local constants.
6. **Scenario activation** — crisis selection resolves the real
   `SCENARIO_REGISTRY`; `scenario.onTick` runs each tick via the existing fault
   API. Crisis cards realigned to real scenario ids (heatwave / storm /
   equipment-failure).
7. **Decision path** — `DecisionRequested` renders in the left Operator Actions
   panel; commit emits the existing `DecisionCommitted`; `Math.random()`
   projections replaced with real numbers from the last `PowerFlowResult`.

---

## §2 Interface structure — mission-control learning UX

Design principle: **the 3D world is the primary experience; UI supports
understanding; never cover the city unnecessarily.** No dashboard overload, no
floating random cards, no gaming HUD.

Console shell (persistent frame; app-flow FSM states render inside it):

```
┌──────────────────────────────────────────────────────────────┐
│ 1. TOP COMMAND BAR                                           │
├──────────┬────────────────────────────────────┬──────────────┤
│ 2. LEFT  │                                    │ 3. RIGHT     │
│ OPERATOR │        3D DIGITAL TWIN             │ ASSET        │
│ ACTIONS  │        (primary, unobstructed)     │ INSPECTOR    │
├──────────┴────────────────────────────────────┴──────────────┤
│ 4. BOTTOM TIMELINE + event stream                            │
└──────────────────────────────────────────────────────────────┘
```

### 1. Top command bar (`CommandBar`)

GridGuard title · current scenario · city status · simulation time ·
grid stability score · pause/play · scenario state. Compact professional
operations header.

### 2. Left panel — operator actions (`OperatorActionsPanel`)

Player decisions as **learning decisions**, not raw engineering controls:
activate renewable reserves · reduce demand · manage EV charging · controlled
load shedding · emergency response. Each shows cost / benefit / risk / expected
impact in plain language ("Reduce commercial AC demand — decreases downtown
stress"), backed by real engine actions (generation dispatch, load-shed fault
API, director decisions). Director `DecisionRequested` prompts surface here.

### 3. Right panel — asset inspector (`AssetInspector`)

On selecting a building, substation/bus, transmission line, or generator:
identity · status · live metrics · cause explanation · impact · recommended
action. Example: "Transmission Line A12 — Critical — High cooling demand
increased electricity flow. Two districts depend on this corridor."

### 4. Bottom timeline (`Timeline`)

Simulation timeline from the EventBus only (no fake entries): scenario start,
decisions, warnings, failures, recovery. Pause, replay, inspect events.

### 5. Learning feedback layer (`LearningFeedback`)

Contextual explanations for important events: What happened? Why? What can you
do? Implemented as a copy map from domain events → learning copy, rendered as
a restrained inline notice (not a toast storm).

### 6. Grid health overview (`GridHealthPanel`)

Compact indicators that each teach something: stability, demand, generation,
renewable %, affected population, recovery progress. No meaningless charts.

### 7. `ScenarioPanel`

Scenario selection/briefing inside the console (replaces full-screen
CrisisSelect flow per the approved "compress to ops boot" decision).

### Component/state rules

- New components live in `src/ui/console/`.
- All data from existing Zustand projections (`simulation-store`, `grid-store`,
  app-flow store) and EventBus subscriptions. **No simulation state duplicated,
  no simulation logic in UI, no fake numbers.**
- Responsive: desktop demo, large screens, presentation mode; clean scaling.

## Validation / exit criteria

✓ UI updates from simulation events (live line loadings, trips, blackouts)
✓ Selecting assets works and shows real metrics
✓ Decisions connect to the real simulation
✓ No fake numbers · no sim logic in UI · no frozen-module edits
✓ `pnpm validate` passes (typecheck, engine typecheck, lint, all tests)
✓ Playwright visual audit: scripted flow with screenshots per app state,
console-error capture; before/after comparison generated

## Out of scope (later sections)

§3 city geometry rebuild, camera system, materials/lighting day-arc rendering,
audio, replay UI wiring, advisor/Gemini integration, After-Action redesign.
