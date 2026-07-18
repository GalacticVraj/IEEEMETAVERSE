# Typography — FROZEN

Two families, one job each. Monospace carries the numbers; sans carries the words. Type is set for a control room: dense, precise, legible, unshowy. No bundled font assets in Phase 1 — **system stacks only** (see [`tailwind.config.js`](../../tailwind.config.js)).

---

## The two families

| Family      | Stack                                                                      | Used for                                                                                         |
| ----------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `font-mono` | `ui-monospace, JetBrains Mono, SFMono-Regular, Menlo, Consolas, monospace` | Telemetry, readouts, values, units, IDs, timers, coordinates, log lines, any number that changes |
| `font-sans` | `Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`            | Labels, prose, headings, button text, descriptions, tooltips                                     |

**The rule:** if it is a measured quantity or a value the simulation produces, it is **mono**. If it is language describing the interface, it is **sans**. Never set telemetry in sans; never set paragraphs in mono.

---

## Telemetry uses tabular figures

Every changing number is set with **`tabular-nums`** (`font-variant-numeric: tabular-nums`). Non-negotiable for readouts.

- Digits occupy fixed cells, so values do not jitter left/right as they update — the number changes, the layout does not.
- Right-align numeric columns; align decimal points.
- Pair value + unit explicitly: value in `ink.primary`, unit suffix in `ink.muted` (e.g. `847` `MW`).
- A live/active readout may take the `instrument` accent; a nominal one stays `ink.primary`.

> A telemetry wall that reflows on every tick reads as a toy. Tabular figures make it read as an instrument.

---

## Scale

Restrained and functional. Prefer a small number of steps; density comes from spacing (see [`spacing.md`](./spacing.md)), not from shrinking type below legibility.

| Role                     | Size     | Family    | Weight  | Notes                         |
| ------------------------ | -------- | --------- | ------- | ----------------------------- |
| Hero readout / countdown | ~28–40px | mono      | 500–600 | Crisis countdown, primary KPI |
| Panel heading            | ~13–14px | sans      | 600     | Uppercase, tracked (below)    |
| Primary readout          | ~16–20px | mono      | 500     | tabular-nums                  |
| Body / prose             | ~14px    | sans      | 400     | `ink.primary`/`secondary`     |
| Label                    | ~12–13px | sans      | 500     | Often uppercase               |
| Unit / caption / muted   | ~11–12px | mono/sans | 400     | `ink.muted`                   |

Sizes are guidance for a coherent scale, not pixel law — but keep steps few and legibility first. Nothing essential below ~11px.

---

## Weights

- **400** — body, prose, secondary values.
- **500** — labels, primary readouts, active values.
- **600** — headings, emphasis, hero readouts.
- **700+** — avoid. Heavy weights read as consumer-app shout; this console does not shout with type, it shouts with semantic color and event-driven motion.

---

## Uppercase labels & tracking

Section labels and panel headings are **uppercase, tracked** — the HMI convention.

- Uppercase for: panel headings, section labels, status tags (`NOMINAL`, `WARNING`, `TRIPPED`), axis titles.
- Apply positive letter-spacing to uppercase runs (`tracking-wide` ≈ 0.05em, up to ~0.08em for small tags). Uppercase without tracking reads cramped.
- Keep uppercase **short** — labels and tags, never sentences or prose.
- Sentence case for body text, tooltips, and descriptions.

---

## Restraint

- **No decorative typefaces**, no display fonts, no font as ornament.
- **No italics** except for a true unit convention or a rare inline emphasis; never for style.
- **No letter-spacing on body text** — tracking is for uppercase labels only.
- **Limit line length** for prose (~66ch) so descriptions stay readable inside dense panels.
- **Consistent number formatting** — fixed decimal places per metric, thousands separators where helpful, units always explicit.
- Type never animates on its own. A value changes because the simulation changed it (see [`motion.md`](./motion.md)); the glyph does not wiggle, pulse, or fade for effect.
