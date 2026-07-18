# `assets/` — `@assets`

Static and procedurally-generated **asset descriptors** — the manifest of anything the presentation layer draws or plays. Per the frozen visual language, GridGuard targets a premium engineering operations console: **geometry is generated procedurally, materials are flat/emissive, and there are zero external 3D files**. As a result this folder is **intentionally near-empty in Phase 1** — there are no assets to declare yet. It exists so that later phases have a single, dependency-free home for asset descriptors (procedural mesh params, palette/material tables, audio manifests) without scattering them through the consumer layers.

**May import:** `@core`, `@app-types` (type-only descriptors, if any).
**Must not import:** `@engine`/`@kernel` or any consumer — assets are declarative data, not logic.

**Key files**

- `.gitkeep` — placeholder so the otherwise-empty folder is tracked by git.

**Phase 1:** **Placeholder / empty** — no descriptors yet; procedural geometry + flat materials mean nothing external to catalogue.
