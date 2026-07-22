# §3 Camera Direction — Implementation Plan

Spec: `../specs/2026-07-22-camera-direction-design.md`. Branch `vraj`.
Commit after each task. Existing tests must stay green throughout.

### Task 1: Shot library + camera store (TDD)
- Create `src/rendering/camera/shots.ts` (pure): TIMING presets, CameraPose,
  OPERATOR_HOME, framing calculators (frameLine/frameNode/frameZone/
  frameCity), INTRO_WAYPOINTS (+captions), decision/crisis shot builders,
  zone centroids from BUS_POSITIONS.
- Create `src/rendering/camera/city-positions.ts` (BUILDING_POSITIONS moved
  from city-layout literals); refactor city-layout to consume it.
- Create `src/rendering/camera/camera-store.ts`: request/priority resolution,
  autoFollow, input suppression, saved pose, transition state.
- Tests: `shots.test.ts` (framing math, centroids, event mapping),
  `camera-store.test.ts` (priority wins/replaces/ignores, suppression
  window with injected now, saved-pose semantics).
- Commit: `feat(camera): shot library + camera intent store (TDD)`

### Task 2: Event focus metadata
- `src/state/event-log-store.ts`: additive `focus?: {kind:'line'|'generator'|'zone'|'city'; id:string}`
  on entries (line trip/recover, generator lost/back, zone blackout/restore,
  cascade origin, decision committed by decisionId mapping). No behavior
  change; existing tests untouched + new assertions.
- Commit: `feat(camera): event log entries carry focus targets (additive)`

### Task 3: CameraDirector + CameraHud + App integration
- `CameraDirector.tsx`: owns OrbitControls + hero orbit + intro spline
  (CatmullRom pos/target curves, arc-length, global smootherstep) + glide/
  hold/return legs + input cancellation (pointerdown/wheel on gl.domElement,
  ESC) + handoff sync. Zero allocations in useFrame.
- `CameraHud.tsx`: Auto-follow toggle, Overview, Skip intro, dev shot name.
- App.tsx: replace AutoOrbitCamera + OrbitControls mounts with
  `<CameraDirector/>`; mount `<CameraHud/>`; hide ConsoleShell until intro
  done; trigger intro on Hero→CrisisSelect once per session.
- Selection watcher (in director): ui-store.selectedAsset → P90 inspect
  shots with save/restore.
- Event watcher (in director): event-log entries → P95 decision / P80 crisis
  follow under the gating rules.
- Commit: `feat(camera): CameraDirector — intro, inspect, decision, crisis choreography`

### Task 4: Validation + evidence + report
- Full suite, typecheck, build. Probe: extend console-probe to screenshot
  intro mid-flight + operator home + a focus shot; console-errors empty.
- Deliverable report in chat (architecture, files, state diagram, demo,
  §4 suggestion).
- Commit: `test(camera): §3 validation evidence`
