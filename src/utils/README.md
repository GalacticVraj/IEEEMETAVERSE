# `utils/` — `@utils`

Pure, **dependency-free** helpers — math routines and runtime assertions. No state, no side effects, no framework imports; safe to import from any layer, including the **engine-standalone build** (`tsconfig.engine.json`) that must compile with React/Three/UI deleted.

**May import:** nothing (leaf-like; `@app-types` type-only at most).
**Must not import:** any other module, and never `react`/`three`/`gsap`/`howler`/`zustand` or any consumer alias.

**Key files**

- `math.ts` — deterministic numeric helpers (used by kernel/engine).
- `assert.ts` — assertion utilities.

**Phase 1:** **Ready** — real and unit-tested (`math.test.ts`).
