# Audio — FROZEN

Audio in GridGuard **follows the simulation; it never leads it.** Music tension tracks crisis severity, the ambient bed tracks weather, and every discrete sound is a cue fired by an event. Nothing plays "for atmosphere" that isn't grounded in simulation state. Sound is the grid making itself heard.

> **Audio reacts to the simulation. If a sound plays, a simulation state or event caused it.**

---

## Adaptive layered music — by tension / severity

Music is **layered and adaptive**, not a fixed track. Layers fade in/out as the simulation's tension rises and falls, driven by state (FSM: `Idle → Pre-Crisis → Crisis → Cascade → Recovery → After-Action`) and severity.

| Sim tension    | Music behavior                                                 |
| -------------- | -------------------------------------------------------------- |
| Idle / nominal | Sparse, calm bed — barely there. The "console is bored" sound. |
| Pre-Crisis     | A low tension layer enters; something is coming                |
| Crisis         | Additional layers build; rhythmic tension rises                |
| Cascade        | Peak intensity — layers stack as failures propagate            |
| Recovery       | Layers recede as zones come back                               |
| After-Action   | Resolve / reflective tone for the recap                        |

Rules:

- **Transitions are smooth crossfades** between layers, tied to state changes — no hard cuts, no track that ignores what's happening.
- **Severity modulates intensity** continuously where possible (more affected zones ⇒ more tension), so the music is a real readout of grid health, not a scripted cue list.
- **Protect the calm** — the idle bed must be genuinely quiet so escalation is felt. (Mirrors the calm-until-crisis principle in [`visual-language.md`](./visual-language.md).)

---

## Ambient bed — by weather

A continuous environmental layer set by the **weather** state (`WeatherChanged`).

| Weather         | Ambient bed                                                            |
| --------------- | ---------------------------------------------------------------------- |
| Clear / calm    | Light coastal ambience — distant surf, gentle air                      |
| Heat / heatwave | Dry, still, cicada-like heaviness (the scenario stressor made audible) |
| Wind / storm    | Rising wind, weather pressure                                          |
| Rain            | Rainfall layer                                                         |

The ambient bed sits **under** the music and reacts to weather changes with smooth transitions. It grounds the city as a real place and reinforces the active crisis scenario.

---

## SFX — event-fired cues

Every discrete sound maps to a catalogued simulation event. No event, no sound.

| Cue                                  | Fired by                                           | Meaning                                                            |
| ------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------ |
| Transformer spark / arc              | `LineOverloaded`, equipment stress                 | Something is being pushed past its limit                           |
| Breaker trip (mechanical clunk/snap) | `LineTripStarted` / `LineTripped`                  | A protection device just opened                                    |
| Cascade step impact                  | `CascadeStep`                                      | A propagating failure landed                                       |
| Alarm / annunciator                  | `LineTripped`, `ZoneBlackout`, critical conditions | An operator-attention condition — stops when acknowledged/resolved |
| Zone de-energize (hum drops out)     | `ZoneBlackout`                                     | Power lost to a district                                           |
| Zone re-energize (hum returns)       | `ZonePowered` / `LineRecovered`                    | Power restored                                                     |
| Decision confirm                     | `DecisionCommitted`                                | The operator's action registered                                   |

Discipline:

- **Alarms mean something.** An annunciator sounds for a real unacknowledged condition and clears when resolved — no alarm spam, no ambient beeping. (SCADA alarm discipline.)
- **Cues are proportionate** — a single line trip is a crisp snap; a full cascade is a build, not one giant boom per step.
- **No decorative UI sounds** — hovers, generic clicks, and idle chimes that don't correspond to a simulation event are forbidden. Interaction feedback is consequence-driven (see [`interaction.md`](./interaction.md)).

---

## Dynamic ducking

The mix is managed so the **most important sound is always audible.**

- When a **critical cue** fires (breaker trip, alarm, cascade step), **duck** the music and ambient bed briefly so the cue reads clearly, then recover.
- **Voice / advisory** (if/when present) ducks music and ambient beneath it.
- Prevent cue pile-ups: throttle/prioritize simultaneous SFX so a cascade doesn't turn into noise — the operator must still parse what happened.
- Ducking is **automatic and event-driven**, part of making audio a legible readout rather than a wall of sound.

---

## Rules

1. **Audio never leads the simulation.** It has no independent timeline; it is a projection of sim state and events, exactly like rendering (see the governing philosophy in the [foundation spec](../superpowers/specs/2026-07-18-gridguard-v3-foundation-design.md)).
2. **Everything is caused** — a sound answers "what event/state produced it." If nothing did, it doesn't play.
3. **Mixed for legibility** — ducking and prioritization keep the meaningful sound on top; calm stays quiet so crisis is heard.
4. **Fully controllable & respectful** — global mute and per-bus volume (music / ambient / SFX / voice); starts within a sensible default level; honors autoplay constraints (no sound before user interaction). Never rely on audio as the _sole_ signal — every state is also visible (color + icon + label), for accessibility.
