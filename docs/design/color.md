# Color — FROZEN

Color in GridGuard is **information, not decoration.** The palette is deliberately narrow: graphite surfaces, a restrained ink ramp, one instrument accent, and five semantic status colors that each map to exactly one simulation condition. Tokens live in [`tailwind.config.js`](../../tailwind.config.js); this document is their meaning.

> **A color on screen answers a question the simulation asked. If it answers no question, it does not belong.**

---

## Surfaces — graphite, low-chroma

The control-room shell. Near-neutral, high legibility, flat (no gradients).

| Token            | Hex       | Role                                      |
| ---------------- | --------- | ----------------------------------------- |
| `surface.void`   | `#08090B` | Deepest background / 3D scene clear color |
| `surface.base`   | `#0E1216` | App background                            |
| `surface.panel`  | `#141A20` | Instrument panel                          |
| `surface.raised` | `#1B222A` | Raised control (buttons, active wells)    |
| `surface.border` | `#232C35` | Hairline dividers only — never fills      |

Depth is expressed by these five discrete steps, not by shadow or blur. Elevation = a step up the surface ramp plus a `surface.border` hairline.

---

## Ink — text

| Token           | Hex       | Role                                              |
| --------------- | --------- | ------------------------------------------------- |
| `ink.primary`   | `#E6EDF3` | Primary readouts, headings, active telemetry      |
| `ink.secondary` | `#9DAAB6` | Labels, secondary values, axis text               |
| `ink.muted`     | `#66727E` | De-emphasized, disabled, unit suffixes, help text |
| `ink.inverse`   | `#0E1216` | Text on a filled status/accent chip               |

---

## Instrument accent — telemetry, selection, focus

The single non-status accent. Used for selection, focus rings, active telemetry traces, and interactive affordances. **Never decorative**, never a brand flourish.

| Token                | Hex       | Role                                                     |
| -------------------- | --------- | -------------------------------------------------------- |
| `instrument.DEFAULT` | `#4FA8C7` | Selection, focus ring, live telemetry trace, active tool |
| `instrument.dim`     | `#2E6B82` | Inactive trace, hover hint, secondary accent             |

---

## Status — SEMANTIC, one color per simulation condition

This is the heart of the palette. Each status color maps to a defined condition on a `LineState` or `ZoneState`. **These meanings are frozen.** Never use a status color for anything but its condition; never invent a sixth status.

| Token             | Hex       | Condition               | `LineState` (line/transformer)         | `ZoneState` (zone/feeder)         |
| ----------------- | --------- | ----------------------- | -------------------------------------- | --------------------------------- |
| `status.nominal`  | `#3FB68B` | Powered / within limits | Loading within rating                  | Fully energized, served           |
| `status.caution`  | `#E0A64B` | Approaching a limit     | Loading nearing rating (early warning) | Stressed / partial reserve margin |
| `status.warning`  | `#E07B39` | Overloaded, pre-trip    | Over rating, protection arming         | Under-served / brownout risk      |
| `status.critical` | `#D14B4B` | Trip / cascade          | Tripped, cascading                     | Cascade-affected                  |
| `status.offline`  | `#556170` | De-energized / blackout | Open / de-energized                    | Blackout, no supply               |

### The severity ladder

`nominal → caution → warning → critical` is a **monotonic escalation ladder**. Color only climbs as the simulated condition worsens and only descends as it recovers (`LineCooling`, `LineRecovered`, `ZonePowered`). `offline` is not on the ladder — it is a distinct de-energized state (grey, absence of power), never a hotter version of critical.

Event → color transitions must be driven by real events:

| Event                             | Transition                         |
| --------------------------------- | ---------------------------------- |
| `LineOverloaded`                  | nominal/caution → warning          |
| `LineTripStarted` / `LineTripped` | warning → critical                 |
| `CascadeStarted` / `CascadeStep`  | affected elements → critical       |
| `ZoneBlackout`                    | zone → offline                     |
| `LineCooling` / `LineRecovered`   | critical/warning → caution/nominal |
| `ZonePowered`                     | offline → nominal                  |

---

## Rules

1. **No gradients.** Surfaces are flat. A gradient asserts a value ramp; using one decoratively lies about the data. The only permissible ramp is one that encodes a real magnitude (e.g. a heat/loading scale), and it must be labeled and legend-backed.
2. **Low chroma by default.** The resting screen is graphite and ink. Saturated pixels are the exception, earned by a simulation condition. Protect the calm state so crisis reads instantly.
3. **Color is never the sole signal.** Per [`src/ui/accessibility/a11y.ts`](../../src/ui/accessibility/a11y.ts), every grid status is conveyed by **icon + label in addition to color** — color-blind safe, always. A red line must also carry a "TRIPPED" label and a trip icon. See [`accessibility`](#accessibility--contrast) below.
4. **One accent only.** `instrument` is the sole non-status accent. Do not introduce blues/teals for decoration — it collides with the accent's meaning.
5. **Status colors are reserved.** Never use `status.critical` for a delete button, `status.nominal` for a generic "go", etc. Status hues belong to grid conditions. Neutral controls use surfaces + ink + instrument accent.
6. **Tokens, not hex.** Components reference token names. Raw hex in a component is a defect.

---

## Accessibility & contrast

- **Ink on surface:** `ink.primary #E6EDF3` on `surface.panel #141A20` and `surface.base #0E1216` clears WCAG AA for body text with wide margin. Use `ink.secondary` for labels, `ink.muted` only for non-essential text (still legible, not for critical readouts).
- **Status legibility:** status colors are tuned to be distinguishable on graphite for the common color-vision deficiencies, but distinguishability is **never assumed** — icon + label are mandatory (rule 3).
- **On filled chips:** when a status color is used as a fill (rare — chips/badges), pair with `ink.inverse #0E1216` for text contrast.
- **Focus:** focus states use `instrument.DEFAULT` and must remain visible against every surface step. Focus is functional, not decorative — keep it obvious (see [`interaction.md`](./interaction.md)).
- **Never rely on hue alone** to distinguish caution from warning from critical: the ladder is reinforced by position, icon, and label.
