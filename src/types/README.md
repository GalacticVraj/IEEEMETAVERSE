# `types/` — `@app-types`

The cross-cutting, dependency-free **type vocabulary**: branded entity ids (`NodeId`, `LineId`, `ZoneId`, `GeneratorId`, `SystemId`, …), branded physical units (`MegaWatts`, `PerUnit`, `Hertz`, `Celsius`, `Seconds`, `Ratio`, …), domain enumerations (`LineState`, `ZoneState`, `GenerationKind`, `WeatherKind`, `Severity`, `GameOutcome`, …), and the kernel runtime-state vocabulary (`KernelState`). Branding makes id/unit mismatches a compile error; the brand is erased at runtime. No behavior lives here.

**Why the alias is `@app-types` (not `@types`):** `@types` is the reserved namespace TypeScript uses to resolve type packages under `node_modules/@types` (e.g. `@types/react`). Aliasing our own module to `@types` would collide with that resolution. `@app-types` keeps our vocabulary unambiguous and separate from third-party ambient types.

**May import:** nothing. This is a pure LEAF — imported by every layer, imports none.
**Must not import:** anything at all.

**Key files**

- `brand.ts` — the `Brand<T, Tag>` primitive.
- `ids.ts`, `units.ts` — branded ids and physical units (+ `as…` constructors).
- `enums.ts` — domain enumerations as `const` objects + unions.
- `kernel-state.ts` — `KernelState` runtime-lifecycle vocabulary (transition rules live in `@kernel/fsm`).

**Ready** — real; the shared vocabulary the whole codebase types against.
