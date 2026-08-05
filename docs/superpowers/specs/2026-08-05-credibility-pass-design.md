# GridGuard — The Credibility Pass

**Date:** 2026-08-05
**Branch:** `vraj`
**Baseline at start:** typecheck 0 errors, 418 tests green, Playwright audit PASS

## Why this work exists

A diagnostic run of the real app (`scripts/visual-audit.mjs`, screenshots in
`docs/superpowers/audit/diagnose/`) showed a widening gap between what the
simulation _computes_ and what the player can _see and trust_.

The layers underneath are sound: the deterministic kernel, DC power flow,
protection relays, and RC thermal models are real and tested. The failures are
all in the layers above them.

Three concrete failures drive this spec:

1. **A developer overlay ships in the player's face.** The `development`
   profile hard-codes `debug.overlay: true`, and `App.tsx` renders it in every
   mode including the hero screen. It reports `fps: —` and `memory: —`, so it
   is not even earning its place.
2. **The 3D misrepresents the domain.** Transmission lines render as cylinders
   lying on the ground at `y = 1.5`, passing through buildings. There are no
   pylons, no conductor height, no sag. Scale is inverted — a "wire" is 1.2
   world units thick while a house is ~5. The 500×500 ground plane's edge is
   visible against gray void. Substations render as wireframe boxes that read
   as rendering errors.
3. **The most prominent number is the least real.** `simulation-engine.ts:274`
   computes `frequency = clamp(60 + 0.005 × (gen − load))`. It is algebraic,
   memoryless, and instantaneous. At −98 MW the display sits at 59.51 Hz
   indefinitely and nothing happens. There is no inertia, no governor
   response, and no rate of change.

Under doctrine #4 (_engineering realism beats visual decoration_) and #2
(_every visual effect must have a traceable simulation cause_), these are not
polish items. They are correctness items.

## Guiding constraints

- **Simulation first.** Physics lands with tests before any renderer reads it.
  No visual in this spec exists without a state variable behind it.
- **Procedural geometry only.** No imported model assets: no licensing
  exposure, no bundle bloat, no mid-demo load failure, and geometry stays
  drivable from simulation state (a breaker that genuinely opens).
- **Frozen visual language holds** (doctrine #3). Premium engineering
  operations console. No glassmorphism, no neon, no decorative gradients.
- **Renderer purity holds.** Rendering reads projections and reports
  selection. It never resolves engine services and never computes state.
- **Determinism holds.** No `Math.random`, no wall-clock in simulation paths.

---

## Workstream 0 — Bug sweep and the debug panel

### Debug overlay

`debug.overlay` becomes `false` in all four profiles. The overlay mounts only
on explicit opt-in, via either a `?debug` URL parameter or a Ctrl+Shift+D
toggle held in `ui-store`. Default state is off everywhere, including
`development`.

Once opt-in, it must be worth opening. It gains real instrumentation:
measured FPS (exponential moving average of frame delta), `performance.memory`
heap where the browser exposes it, simulation tick rate, renderer draw calls
and triangle count, and the power-flow residual from the solver. It moves
clear of the command bar.

### Scene bugs

- **World bounds.** The 500×500 plane's edge is visible from the hero camera.
  Replaced with a bounded world: terrain that extends past every camera
  station, water to the horizon, and distance fog tuned so no edge is
  reachable from any shot in the camera library.
- **Canvas bleed.** The scene renders behind the 176px timeline bar and shows
  through. The bar becomes opaque to the viewport bottom.
- **Solar farm.** Currently an oversized tilted rectangle floating clear of
  the ground and clipping fog. Rebuilt to scale as a real array (workstream 2).
- **Substation markers.** The `default` branch of `StylizedBuilding` renders a
  `wireframe` box. Removed entirely — substations become real geometry.
- Console warnings, React key warnings, and undisposed material/geometry leaks
  cleared.

### Acceptance

Fresh load in every profile shows no overlay. `?debug` shows it with live
non-placeholder numbers. No ground edge is visible from any camera station in
`shots.ts`. Audit run reports zero console errors and zero warnings.

---

## Workstream 1 — Physics: real frequency dynamics

New pure module `src/engine/frequency/`. No DOM, no React; compiles under
`tsconfig.engine.json`.

### Swing equation

System frequency becomes a state variable integrated each tick rather than a
formula evaluated each tick:

```
df/dt = f₀ / (2 · H_sys · S_base) · (P_mech − P_elec − D · Δf)
```

Fixed-step integration at the kernel tick rate, deterministic, with the
integrator state captured and restored through the existing snapshot path so
replay stays bit-identical.

### Inertia from the online fleet only

`H_sys · S_base` is recomputed each tick by summing over generators that are
**online and synchronous**. Inverter-coupled plant contributes nothing.

Meridian Bay's actual fleet:

| Generator | Kind       | MW  | H (s) | Contributes inertia  |
| --------- | ---------- | --- | ----- | -------------------- |
| G-BASE-S  | Baseload   | 400 | 5.0   | yes                  |
| G-PEAK-S  | Peaker     | 150 | 4.0   | yes                  |
| G-PEAK-IN | Peaker     | 80  | 4.0   | yes                  |
| G-GAS-HB  | Peaker     | 60  | 4.0   | yes                  |
| G-IMPORT  | Import tie | 200 | 3.0   | yes (remote system)  |
| G-SOLAR   | Solar      | 120 | —     | **no**               |
| G-WIND    | Wind       | 90  | —     | **no**               |
| G-BATT-DT | Storage    | 50  | —     | **no** (but see FFR) |

All synchronous plant online: `H·S = 3,760 MW·s`, `H_sys ≈ 3.27 s` on a
1,150 MVA base.

This is the point of the whole workstream. As renewables displace thermal
plant, `H_sys` falls and the grid becomes twitchy. That is the defining
problem of modern power systems and the strongest engineering claim GridGuard
can make to an IEEE audience. It is also _emergent_ — nothing scripts it.

Worked example, the scenario's existing harbour trip at tick 300 (loses the
200 MW import):

```
RoCoF = ΔP · f₀ / (2 · H·S) = 200 × 60 / (2 × 3,160) ≈ 1.9 Hz/s
```

Real systems arm RoCoF protection around 1 Hz/s. So the scripted fault now
produces a genuinely alarming, physically correct transient that crosses UFLS
thresholds within roughly a second — drama that falls out of the physics
rather than being staged.

### Governor droop

Online units with headroom pick up load on 5% droop:

```
ΔP_i = −Δf / (R_i · f₀) · P_rated_i,  clamped to available headroom
```

This produces the classic primary-response curve: the fall is arrested, then
frequency settles at a steady-state offset below nominal rather than returning
to 60 Hz. Recovering the offset requires operator action — which is exactly the
lesson.

Ramp limits are respected per generator kind: baseload cannot ramp, peakers
ramp fast, storage responds within a tick.

### Under-frequency load shedding

A staged UFLS relay scheme, automatic and outside operator control:

| Stage | Threshold | Sheds             |
| ----- | --------- | ----------------- |
| 1     | 59.3 Hz   | 5% of system load |
| 2     | 59.0 Hz   | 10%               |
| 3     | 58.7 Hz   | 10%               |

Each stage latches, emits a first-class event, and darkens real districts.
Protected loads (hospital, water treatment) are excluded from shedding, which
makes the existing equity model matter.

The demo beat this creates: _the grid saved itself, but 15% of the city went
dark, and that is on you for acting too late._

### Supporting outputs

- **Per-bus voltage estimate.** Derived from DC angles plus a reactive proxy,
  so voltage sag is expressible per district. Drives brownout flicker in
  workstream 2. Presented explicitly as an estimate, not an AC solution.
- **N-1 contingency screening.** Each tick, evaluate: if the single largest
  in-feed tripped right now, would any line exceed its rating, or would
  frequency breach 59.5 Hz? Result is a live **Secure / At-Risk / Insecure**
  indicator. This is what control-room operators watch continuously, and it
  turns the game from reactive to anticipatory.
- **What-if projection API.** A pure function running a candidate operator
  action forward N ticks against a _copy_ of state, returning projected
  deltas. Feeds the predictive levers in workstream 3. Never mutates live
  state.

### Testing

TDD throughout. Coverage must include: RoCoF magnitude against hand-computed
values for known ΔP and H; governor arrest and steady-state offset; UFLS stage
latching and threshold ordering; inertia falling as synchronous plant trips;
determinism across identical seeds; and snapshot/restore round-trip fidelity.

### Acceptance

`pnpm typecheck:engine` green. Frequency responds with visible dynamics — fall,
arrest, settle — rather than a step. Losing a large synchronous unit measurably
increases RoCoF for an identical subsequent MW loss.

---

## Workstream 2 — The 3D rebuild

All procedural, instanced where count justifies it, zero allocations in
`useFrame`.

### Transmission corridors

The headline fix, replacing the ground-level cylinders.

- **Lattice pylons** — four tapered legs, cross-bracing, cross-arms, insulator
  strings. Placed along each corridor at realistic spacing. Approximately 35 m
  tall, which makes them the dominant vertical element of the skyline and
  re-establishes correct scale against buildings.
- **Conductors** — strung pylon to pylon as true catenary curves (`cosh`), in
  three phases plus an earth wire, at correct thin gauge. Tube geometry swept
  along the computed curve.
- **Flow pulses** — instanced beads travelling each conductor. Direction is
  the sign of the real MW flow, speed is proportional to |MW|, spacing and
  emissive intensity track loading, colour follows the existing loading ramp.
  This is the literal answer to "show the electricity working."
- **On trip** — pulses stop, the conductor greys and slackens, and the breaker
  at the terminal substation opens with a brief arc flash.

### Substations

Real geometry at each bus: fenced yard, transformer tanks with radiator banks
and bushings, busbars, disconnects, and breakers whose contacts genuinely
separate when the protection engine opens that line. A status beacon carries
the bus state.

### Generators that show their physics

- **Thermal** — cooling towers and stacks; plume height and opacity scale with
  real MW output; goes cold and still when tripped.
- **Wind** — rotor rpm is real output, not decoration; blades feather on
  curtailment.
- **Solar** — array tracks the sun through the day arc; output visibly
  collapses at dusk, which is _why_ the evening peak is the dangerous one.
- **Battery** — rack with a visible state-of-charge indicator.

### City density and scale

- Instanced building fields — hundreds of structures rather than the current
  30 — with district identity: a downtown high-rise core, residential street
  grids, industrial sheds, harbour cranes.
- Rebuilt scale relationships throughout.
- Street grid with kerbs and junctions; bay and coastline bounding the world.
- **Rooftop AC units that spin when AC load is high**, so "reduce residential
  AC" has a literal, visible, city-wide consequence.
- Window lights follow per-zone served load; **brownout flicker** follows the
  new voltage estimate; full darkness on blackout.

### Lighting and atmosphere

Key/fill/rim rig following the existing day arc, contact shadows, heat shimmer
over the industrial zone during the heatwave, bloom restrained to true
emissives only.

### Acceptance

No geometry intersects other geometry incorrectly. Frame budget holds at 60fps
on integrated graphics at 1080p. Every animated property traces to a named
simulation variable — enforced by review against doctrine #2.

---

## Workstream 3 — Guidance and learning

- **Objective bar.** What winning means, live and always visible: frequency
  band, zones dark, corridor stress, N-1 security, time remaining.
- **Predictive levers.** Each operator action shows its engine-computed
  projection before commit — e.g. _"−78 MW · stress 58% → 41% · freq +0.18
  Hz"_ — sourced from the what-if API in workstream 1, never estimated in the
  UI.
- **A timeline that teaches.** Currently empty at T+00:10 while frequency
  collapses. It fills with every real event, each carrying what happened, why,
  and what to do about it, and clicking one focuses the camera on the asset
  involved.
- **Alarm choreography.** When RoCoF exceeds threshold or N-1 screening goes
  insecure, the console escalates and the camera cuts to the cause.
- **After-action with real traces.** Frequency plot with UFLS thresholds
  marked, RoCoF, reserve margin over time, and system inertia over time — the
  actual physics of the run just played.

---

## Workstream 4 — UI/UX

Within the frozen doctrine:

- Frequency becomes a proper instrument: gauge with safe band, trend
  sparkline, and RoCoF readout.
- Real typographic hierarchy; tabular numerics everywhere numbers change.
- Alarm states signalled by colour **and** shape, never colour alone.
- Chip-row overlap and dead space resolved.
- All motion respects `prefers-reduced-motion`.

---

## Sequencing

Bug sweep → physics → 3D rebuild → guidance → UI polish.

Physics precedes the 3D rebuild because the rebuild's most important visuals
(flow pulses, brownout flicker, breaker motion, plume scaling) read variables
that workstream 1 introduces. Building them in the other order would mean
inventing placeholder state, which doctrine #1 forbids.

## Verification

Each workstream is a separate commit on `vraj`. At every commit: `pnpm
typecheck`, `pnpm typecheck:engine`, and the full test suite must be green, and
`scripts/visual-audit.mjs` must pass with screenshots captured for review.

Known pre-existing debt explicitly _not_ addressed here: the repo's ~440
baseline lint errors, and the render-starved headless audit (~0.15 sim-seconds
per real second) which means audit sampling windows under ~15s produce false
negatives.

## Out of scope

Vehicles, trains, and pedestrians. A music system. SSAO and screen-space
reflections. AC power flow with a full reactive solution — the voltage estimate
is explicitly an estimate and will be labelled as such.
