# §3 Camera Direction System — Design Spec (approved)

Date: 2026-07-22 · Branch: `vraj` · Depends on: §1+§2 experience foundation

## Objective

Replace the developer camera with a single Camera Direction System that reads
like a professional digital twin (Apple Maps Flyover / Google Earth Studio /
NASA mission control) — quietly guiding attention without taking control from
the operator. No game cinematics, no scripted cutscenes, no faked events.

## Frozen (never modified by §3)

Simulation kernel, electrical graph, power flow, protection, scenario
framework, the 7 Mission Control console components, event-driven simulation
behavior. Camera reacts ONLY to real simulation state via projections.

## Architecture — Approach A (single owner)

ALL scripted camera movement flows through one `CameraDirector`. Ownership is
never split across camera components (the §2 AutoOrbitCamera and bare
OrbitControls mount are absorbed into it).

New: `src/rendering/camera/`
- `camera-store.ts` — Zustand (UI-owned): current request + priority,
  autoFollow, lastUserInputAt, saved pose, current shot name, transition
  state, intro state. No simulation state duplicated.
- `shots.ts` — PURE shot library + framing math. Shots define framing only;
  the director interpolates. Named shots: OperatorHome, Intro_* (Generation,
  Harbor, Industrial, Downtown, Hospital, Residential…), Inspect_Line,
  Inspect_Substation, Inspect_Generator, Inspect_District/Building,
  Critical_Blackout, Critical_ProtectionTrip, Recovery, Decision_Action,
  Replay_Start/End (reserved).
- `CameraDirector.tsx` — the one mover (inside Canvas). Owns OrbitControls,
  hero ambient orbit, intro spline, glide/hold/return legs, handoff.
- `CameraHud.tsx` — minimal overlay: Auto-follow toggle, Overview, Skip
  intro, current-shot readout (dev only). Does not touch console components.
- `city-positions.ts` — building coordinates extracted from city-layout (one
  source of truth; city-layout consumes it — mechanical refactor).

## Priority system

Requests resolve by priority; higher always wins, equal replaces (newest),
lower is ignored while a higher one is active:

| P | Source |
|---|---|
| 100 | Intro sequence |
| 95 | Decision camera (player action) |
| 90 | User-selected asset (inspect) |
| 80 | Critical grid event follow |
| 70 | Replay follow (reserved — same pipeline) |
| 60 | Operator home (Overview) |
| 0 | Manual orbit |

Canvas user input (pointer/wheel on the GL element, or ESC) immediately
cancels scripted motion: intro → skip-to-home; any other shot → control
handed to the user where the camera stands.

## Intro (8–10 s, skippable)

Trigger: Begin Shift (Hero → CrisisSelect) once per session. Console stays
hidden until Operator Home. One continuous arc-length-parameterized
Catmull-Rom flight (position + look-target curves), globally eased:
Meridian Bay wide → Generation (GS1) → transmission sweep → Industrial →
Hospital → Downtown → Residential (GN1/RN) → pull back to Operator Home.
Lower-third captions per district keyed to progress. Skip button + ESC jump
smoothly (FAST) to Operator Home.

## Transitions

Frame-delta interpolation only (no wall-clock tween libraries). Global-eased
smootherstep over per-shot durations. Timing presets: FAST 0.7 s / NORMAL
1.4 s / SLOW 2.2 s / CINEMATIC 3.2 s. No allocations in useFrame — all
vectors/quaternions preallocated and reused. No React state updates per
frame. Handoff re-syncs OrbitControls target so there is never a jump.

## Operator camera

Stable OperatorHome framing; existing orbit limits kept (polar 0.35–1.25,
distance 80–420, no pan). Overview button glides home (NORMAL).

## Asset inspection (P90)

On `ui-store.selectedAsset`: save current pose once, glide to contextual
framing (line → midpoint, distance ∝ length; bus/generator/building →
offset orbit; district → centroid + radius). Never zoom tighter than ~55
units — surrounding city stays visible. Deselect glides back to the saved
pose. Coordinates come from layout.ts / city-positions.ts only.

## Decision camera (P95)

On DecisionCommitted (real bus event, surfaced through the event log with a
focus target): glide toward the affected district (op-ac-residential →
RN+RS, op-lights-commercial → DT, op-shed-industrial → IN, op-shed-harbor →
HB, op-ev-pause → city-wide, director-prompt decisions → city-wide), hold so
the simulation response is visible (~3.5 s), return automatically to the
prior pose. Reinforces consequence visibility.

## Crisis choreography (P80)

Listens only to real events (via event-log projection entries carrying an
additive `focus` target — the only touch to §2 state, additive metadata, no
behavior change). Protection trip / cascade / blackout / generator loss /
recovery: IF autoFollow AND no user input for 8 s AND nothing selected AND
intro done → contextual glide (wider than inspect framing), brief hold,
return to Operator Home. Latest-highest severity wins. User input cancels
instantly and suppresses following for 8 s.

## Replay (reserved)

Replay playback is not wired in the app (out of §3 scope, per decision).
The P70 slot + Replay_Start/End shots + the event-follow pipeline are the
mechanism a future replay will drive — a replayed run re-emits the same
events through the same bus → same log → same camera behavior.

## Validation gates

Intro completes and skips cleanly; input instantly overrides; no jumps at
handoff; asset framing correct for all four kinds; crisis follow works;
sim + UI untouched; full test suite green; production build green.
