# Motion — FROZEN

Motion in GridGuard is **caused, never decorative.** The screen is still until the simulation does something. Then motion appears — proportionate to the event — and settles back to still. This is the visible form of the core rule.

> **If a pixel moves, a simulation event caused it, and you can name the event.**

---

## The one rule

Every animation traces to a catalogued simulation event (`LineOverloaded`, `LineTripStarted`, `LineTripped`, `CascadeStarted`, `CascadeStep`, `ZoneBlackout`, `ZonePowered`, `WeatherChanged`, `DecisionRequested`, `DecisionCommitted`, …). Rendering/UI/effects are **consumers**: they subscribe to events and animate in response. They never animate on a timer, on idle, or "to feel alive."

**Practical gate for any motion you propose:**

1. Name the event that fires it.
2. State what the motion communicates about the simulation.
3. If either is blank — cut it.

---

## What is banned

| Banned motion                                                                     | Why                                                                        |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Idle / ambient animation (breathing panels, drifting particles, looping shimmer)  | No simulation cause; competes with real signals; dilutes crisis legibility |
| Decorative entrance animations (staggered card fly-ins, bounce, spring for style) | Consumer-app flourish; slows the operator                                  |
| Hover wobble, pulsing buttons, attention-seeking loops                            | Noise; the console is calm until crisis                                    |
| Parallax / scroll-driven effects for their own sake                               | Marketing-site language                                                    |
| Motion whose speed/size is unrelated to event severity                            | Breaks traceability — motion must be proportionate                         |

Purely decorative animation is on the FORBIDDEN list in [`visual-language.md`](./visual-language.md).

---

## What is allowed (because it's caused)

| Motion                                      | Caused by                                         | Communicates                                                             |
| ------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| Status color transition along the ladder    | `LineOverloaded`, `LineTripped`, `LineCooling`, … | Condition worsening/recovering                                           |
| Cascade propagation sweep                   | `CascadeStep`                                     | Which elements failed, in order, at real cadence                         |
| Telemetry value updates                     | `PowerFlowSolved`, `LoadChanged`                  | New measured state (via tabular figures — value changes, layout doesn't) |
| Alarm attention pulse on a critical element | `LineTripped`, `ZoneBlackout`                     | An unacknowledged critical condition (stops when acknowledged/resolved)  |
| Decision Wheel open + delta preview         | `DecisionRequested` / user intent                 | A decision is available; here is its predicted consequence               |
| Camera cinematic tween                      | Director / event (see [`camera.md`](./camera.md)) | Directing attention to where the crisis is                               |
| HUD panel reveal for a new alert            | Zone/line event                                   | New information demands attention                                        |

---

## GSAP for cinematics

- **GSAP** drives cinematic camera moves and orchestrated HUD sequences (see [`camera.md`](./camera.md)) — timelines with coordinated, sequenced beats.
- Everyday state transitions (a color climbing the ladder, a value updating) are lightweight CSS/transition-level changes, not GSAP timelines.
- Reserve GSAP for **directed moments** the simulation escalates into (a cascade reveal, an after-action recap). Even these are event-fired, never on load for show.

---

## Easing & duration

Motion feels like instrumentation responding, not UI showing off.

| Kind                             | Duration               | Easing               | Notes                                                               |
| -------------------------------- | ---------------------- | -------------------- | ------------------------------------------------------------------- |
| State transition (color, value)  | 120–200ms              | ease-out / linear    | Quick, unfussy; telemetry keeps up with the tick                    |
| Element reveal (new alert/panel) | 180–260ms              | ease-out             | Appears with intent, no bounce                                      |
| Alarm attention pulse            | ~800–1200ms loop       | ease-in-out          | Only while a critical condition is unacknowledged; stops on resolve |
| Cinematic camera tween           | 600–1500ms             | ease-in-out (custom) | Directed, smooth, readable                                          |
| Cascade step cadence             | matched to sim cadence | linear               | Timing reflects the simulation, not an arbitrary curve              |

- **No bounce/elastic/overshoot** — those read as playful. Easing is calm and mechanical.
- **Durations proportionate to severity/scope**: a small state change is fast; a full cascade reveal takes longer because more happened.
- **Respect `prefers-reduced-motion`**: reduce or cut non-essential motion; state must still be conveyed by color + icon + label + value (see [`color.md`](./color.md)) so nothing is lost.

---

## Juice & hit-stop — earned, and traced

"Juice" (hit-stop, micro-shake, impact emphasis) is permitted **only for genuine simulation impacts** and must trace to the event that justifies it.

- A breaker **trip** or a **cascade step** may carry a brief hit-stop / snap of emphasis — because something physically failed.
- A hover, a selection, or a routine value update **may not** — nothing failed.
- Keep juice **brief and proportionate**; it punctuates a real consequence, it does not decorate an interaction. Overused juice becomes decorative animation by another name — which is forbidden.

> Feedback in GridGuard is **consequence-driven**: motion is the simulation making itself felt, never the UI performing.
