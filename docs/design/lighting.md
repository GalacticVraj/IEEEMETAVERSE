# Lighting — FROZEN

Lighting establishes a believable **coastal city** and, more importantly, makes grid state physically visible: when power flows, windows glow; when a zone blacks out, it goes dark. Light in GridGuard is a **telemetry channel**, not mood decoration. Restraint is the rule — postprocessing is capped so the scene stays legible and performant.

---

## The three-light base

A conventional, restrained rig for Meridian Bay.

| Light       | Role                                                                                                      |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| **Key**     | Primary directional light = the sun/moon. Sets time of day, casts the main shadows, defines form.         |
| **Fill**    | Soft secondary light lifting shadow detail so the city stays readable — low intensity, cool coastal tint. |
| **Ambient** | Base environmental term (sky/hemisphere) so nothing is pure black; keeps geometry legible even in shadow. |

The rig is calm and neutral. It is a stage light for an instrument, not a dramatic film gel. No colored party lighting, no lens flares as decoration.

---

## Load-reactive window emissive — the key mechanic

**Building window emissive encodes grid state.** This is the single most important lighting behavior, and it is strictly event-driven.

| Zone / line condition               | Window emissive                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| `nominal` — powered, within limits  | Warm, steady window lights at normal density                                      |
| `caution` — approaching a limit     | Subtle dimming / fewer lit windows (stress showing)                               |
| `warning` — under-served / pre-trip | Noticeably dimmer, flicker permissible **only** as a simulated instability signal |
| `critical` — cascade-affected       | Rapid loss of lit windows following the cascade                                   |
| `offline` — blackout                | Windows dark; the zone visibly goes out                                           |

Rules:

- **Driven by events**, never by a timer: `ZonePowered` lights a zone; `ZoneBlackout` darkens it; `CascadeStep` propagates darkening element by element (see [`motion.md`](./motion.md)).
- **The color semantics** of status live in the HUD/telemetry (see [`color.md`](./color.md)); window emissive primarily encodes **presence and intensity of power** (lit ↔ dark, bright ↔ dim). Don't recolor whole districts red — that reads as neon. Darkness is the blackout signal.
- **Flicker is a signal, not an effect** — allowed only to represent genuine simulated instability, never for ambience.

---

## Day / night & blackout darkening

- **Day/night** is a slow, motivated change of the key light (time of day in the simulation), not an idle loop. It sets how dramatic a blackout reads — a night blackout is a stark, memorable demo moment; protect that contrast.
- **Blackout darkening** is the payoff: as zones lose power, the city's contribution to the scene's brightness falls. A cascading blackout visibly sweeps the city dark. This is a designed **memorable demo moment** — keep it legible and let it land.
- **Never fully black** — ambient + moonlight keep geometry readable so the operator still sees the city they're trying to save.

---

## Postprocessing — capped

Postprocessing is deliberately limited. It sharpens realism and readability; it does not glamour the scene. Two profiles by device capability:

| Profile     | Allowed effects                                                           |
| ----------- | ------------------------------------------------------------------------- |
| **Low-end** | Bloom (restrained) + Vignette + **one of** SSAO _or_ Chromatic Aberration |
| **Desktop** | Full stack — Bloom + Vignette + SSAO + Chromatic Aberration               |

Discipline:

- **Bloom is restrained** — it makes window lights read as light sources; it must never wash out the scene or turn the city neon. If bloom is making things glow, turn it down.
- **Vignette** focuses attention on the city center; subtle, not a dark frame.
- **SSAO** grounds geometry (contact shadows) for realism.
- **Chromatic aberration** is a whisper at the edges for lens realism — never a stylistic smear.
- **No forbidden looks:** no glassmorphism blur over the scene, no neon glow, no god-ray spectacle for its own sake, no decorative color grading. (See the FORBIDDEN list in [`visual-language.md`](./visual-language.md).)

---

## Performance & restraint

- Effects scale down before frame rate suffers — legibility and responsiveness beat visual richness.
- Shadows are budgeted (cascaded/limited) — the city must stay readable and the sim responsive.
- Every lighting change that isn't the slow day/night cycle traces to a simulation event. Idle shimmer, pulsing ambient, and mood animation are forbidden — light moves because power moved.
