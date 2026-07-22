# §5 Competition Polish — Triage & Design (executing)

Date: 2026-07-22 · Branch: `vraj` · Depends on: §1–§4 (all frozen)

## Triage principle

Impact on judge comprehension ÷ effort, FPS never sacrificed. Every kept item
supports learning; deferred items are listed honestly.

## Executing (in order)

1. **Atmosphere (Phase 1/2 subset)** — sky gradient dome + distance haze
   (fog), animated harbor/pond water, wind turbines whose rotor speed follows
   REAL wind-farm output, hospital beacon kept, district ground tint patches
   for identity, subtle cloud drift. All procedural, zero textures, zero new
   per-frame allocations.
2. **Audio (Phase 3)** — WebAudio-synthesized layer (no asset files):
   ambient city/wind bed, relay-trip thunk, recovery chime, warning pulse,
   advisor tick, UI click. Driven by an audio-director subscribed to the
   event log + bus (consumer only). Master toggle, default ON at low gain,
   persisted in ui prefs; respects reduced-motion users' likely preference.
3. **Microinteractions + onboarding (Phases 4+5)** — panel mount fade/slide,
   hover elevation, animated value transitions in GridHealth (CSS), mission
   briefing card at CrisisSelect (objective in <30 s), static HTML loading
   splash before React mounts.
4. **Demo mode (Phase 6)** — one-click competition demo: `?demo` URL param +
   Hero button. A demo-driver walks the REAL flow through public APIs only:
   Begin Shift → intro → auto-start heatwave → waits for real stress →
   executes the strongest teaching decision → lets protection/recovery play
   → End Shift at T+02:00 → After-Action. Nothing simulated is faked; the
   driver only presses the same buttons a human would.
5. **Accessibility (Phase 7 subset)** — reduced-motion mode (respects
   `prefers-reduced-motion`: skips intro, disables auto-follow + pulses),
   keyboard shortcuts (Space pause/resume, O overview, Esc existing, M mute),
   UI scale already via presentation media query; readable type + captions
   already core to the console (all events are text).
6. **Performance (Phase 8)** — manualChunks vendor split (three/react),
   re-run tick benchmark, verify zero per-frame allocation patterns, audit
   with the probe suite.
7. **Submission readiness (Phase 9) + final audit** — loading splash, no
   debug UI outside development profile (already true), console-error-free
   full-flow audit, readiness report.

## Deferred (honest, with reasons)

3D vehicles/trains/pedestrians/birds/cranes (art budget + FPS risk, low
learning value), SSAO/reflections (post-processing cost on integrated GPUs),
texture compression (no textures — fully procedural), large-cursor mode
(OS-level feature), full music system (ambient bed suffices for a 10-minute
judged demo).
