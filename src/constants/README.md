# `constants/` — `@constants`

Named constants and the canonical **`GRID_EVENT` registry**. It exists so that no magic number and no anonymous event-name string ever appears elsewhere: all code references `GRID_EVENT.X` (never a string literal), and simulation tunables (default timestep, tick rate, pixel-ratio cap) are named here. Adding an event means adding it here **and** to `GridEventMap` in `@core` — the compiler enforces the pairing.

**May import:** `@app-types` only.
**Must not import:** anything else — it is a pure leaf; no framework, no consumer.

**Key files**

- `events.ts` — `GRID_EVENT` registry + `GridEventName` union (all catalogued event names).
- `simulation.ts` — named simulation constants (`DEFAULT_TIMESTEP`, `DEFAULT_TICK_RATE_HZ`, `MAX_DEVICE_PIXEL_RATIO`, …).

**Phase 1:** **Ready** — real; the event catalogue is complete and drives the typed bus.
