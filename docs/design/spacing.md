# Spacing & Layout — FROZEN

The console is **dense but breathable.** Density earns trust — an instrument panel packs information — but density without rhythm becomes noise. Space is metered on a consistent scale, separation is done with hairlines rather than gaps-plus-shadows, and radii stay small.

---

## Spacing scale

A 4px base grid. Use these steps; do not invent in-between values.

| Token | px  | Typical use                                               |
| ----- | --- | --------------------------------------------------------- |
| `0.5` | 2   | Icon-to-label, tightest inline gap                        |
| `1`   | 4   | Dense inline gaps, chip padding                           |
| `2`   | 8   | Default gap between related controls, tight panel padding |
| `3`   | 12  | Standard intra-panel gap                                  |
| `4`   | 16  | Panel padding (default), section gap                      |
| `6`   | 24  | Between panel groups                                      |
| `8`   | 32  | Major layout regions                                      |
| `12`  | 48  | Top-level frame margins (sparingly)                       |

Rhythm rule: **spacing steps up as grouping widens** — 2/4px inside a control, 8/12px within a panel, 16/24px between panels, 32px+ between regions. Consistent steps are what make density read as order instead of clutter.

---

## Instrument density

- **Pack purposefully.** A panel should feel like it earns its footprint — full of relevant readouts, not padded whitespace. This is a control room, not a landing page.
- **Density comes from tight, consistent spacing** (2–8px inside panels) and small radii — **not** from shrinking type below legibility (see [`typography.md`](./typography.md)).
- **Breathe at the seams.** Adjacent panels get a hairline + a modest gap so groups stay distinct. Dense _within_, separated _between_.
- **Align to a grid.** Readouts align in columns; labels align; numbers right-align (tabular figures). Optical alignment is part of looking engineered.

---

## Hairline borders

Separation is done with **1px `surface.border` (`#232C35`) hairlines**, not with drop shadows, glows, or large gaps.

- Panels, dividers, table rules, and control edges use a 1px `surface.border` line.
- **No drop shadows** for elevation — elevation is a step up the surface ramp (`base → panel → raised`) plus a hairline (see [`color.md`](./color.md)).
- **No glow borders**, no double borders, no decorative frames.
- Internal dividers (between readouts in a panel) use the same hairline, optionally at reduced opacity for a lighter rule.

---

## Grid gaps

- Default gap between grid cells / tiles: **8px** (`gap-2`) for dense clusters, **12–16px** (`gap-3`/`gap-4`) for panel-level layout.
- Keep gutters uniform within a region — mixed gutters read as broken alignment.
- Telemetry tiles in a cluster: tight, equal gaps, hairline separation, aligned baselines.

---

## Panel padding

| Panel type                | Padding                          |
| ------------------------- | -------------------------------- |
| Dense telemetry panel     | 8–12px (`p-2`–`p-3`)             |
| Standard instrument panel | 16px (`p-4`)                     |
| Header / label strip      | 8px vertical, 12px horizontal    |
| Chip / tag                | 2–4px vertical, 6–8px horizontal |

Padding is consistent across panels of the same type. A grab-bag of paddings is the fastest way to look un-engineered.

---

## Radii

Restrained. Instrument panels, not consumer cards. Tokens from [`tailwind.config.js`](../../tailwind.config.js):

| Token                | Radius | Use                                                  |
| -------------------- | ------ | ---------------------------------------------------- |
| `rounded-instrument` | `2px`  | Chips, tags, small controls, inputs, telemetry wells |
| `rounded-panel`      | `4px`  | Panels, cards, larger containers                     |

**Never exceed 4px** for structural surfaces. Circular elements are allowed only where geometry demands it (the radial Decision Wheel, gauges, dials) — those are instruments, not rounded cards. Oversized rounded corners are forbidden (see [`visual-language.md`](./visual-language.md)).

---

## Layout discipline

- **Stable regions.** The frame (crisis banner, zone panels, telemetry, chrome) has fixed regions; panels don't reflow arbitrarily as data updates (tabular figures + fixed cells keep layout still).
- **Reading order drives placement** — see [`visual-hierarchy.md`](./visual-hierarchy.md). Highest-priority information (crisis banner / countdown) gets the most prominent, most stable position.
- **The canvas is the stage.** UI chrome frames the 3D scene of Meridian Bay; it does not bury it. Panels dock to edges; the center stays the simulation.
