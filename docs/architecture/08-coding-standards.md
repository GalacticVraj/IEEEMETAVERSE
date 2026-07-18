# 08 · Coding Standards

Standards exist to make the architecture's guarantees mechanical rather than aspirational. Most of these are enforced by the compiler, ESLint, or CI — a violation fails a check, not a review.

## Strict TypeScript

`tsconfig.base.json` turns on the strictest practical flag set. No `any`, no implicit `any`, no unchecked index access.

| Flag                         | Effect                                                                  |
| ---------------------------- | ----------------------------------------------------------------------- |
| `strict`                     | The full strict family (null checks, strict function types, etc.).      |
| `noUncheckedIndexedAccess`   | `arr[i]` is `T                                                          | undefined` — forces bounds handling. |
| `exactOptionalPropertyTypes` | `{ x?: T }` distinguishes "absent" from `undefined`.                    |
| `noImplicitOverride`         | Overrides must say `override`.                                          |
| `noFallthroughCasesInSwitch` | No accidental `case` fallthrough.                                       |
| `noImplicitReturns`          | Every code path returns explicitly.                                     |
| `verbatimModuleSyntax`       | Type-only imports are erased predictably; pairs with `isolatedModules`. |
| `isolatedModules`            | Every file transpiles standalone (Vite/esbuild requirement).            |

Two TS projects: `tsconfig.json` (whole app) and `tsconfig.engine.json` (pure layers, `lib: ES2022`, `types: []`, no DOM). Both must pass — see [03](./03-dependency-graph.md).

## Modules and exports

- **Named exports only.** Default exports are banned via ESLint `no-restricted-syntax` (barrel-friendly). Narrow exceptions: `.tsx` component files and framework config entry points (`vite.config.ts`, `vitest.config.ts`).
- **Barrel `index.ts` per module.** Consumers import from the alias (`@core`, `@engine`), not deep paths — e.g. `import { createEventBus } from '@core'`.
- **Path aliases everywhere.** `@core @kernel @engine @scenarios @learning @ethics @replay @rendering @ui @audio @infra @state @debug @config @workers @utils @constants @app-types @assets`. Note the shared types alias is **`@app-types`**, not `@types`.
- **ES modules** throughout (`"type": "module"`).

## No magic numbers

Every physical/timing quantity is a named constant in `@constants` (or a profile value in `@config`). ESLint `no-magic-numbers` warns on stray literals (ignoring `0, 1, -1, 2, 100, 1000`, enum values, and readonly class props). The canonical constants — `DEFAULT_TIMESTEP`, `NOMINAL_FREQUENCY`, `OVERLOAD_THRESHOLD_PU`, `TRIP_THRESHOLD_PU`, `BLACKOUT_VOLTAGE_PU`, `MAX_DEVICE_PIXEL_RATIO` — carry the literal with an inline `eslint-disable` at the definition, so the literal appears exactly once.

## Branded types

Physical quantities and ids are branded (`MegaWatts`, `PerUnit`, `Hertz`, `Seconds`, `LineId`, `ZoneId`, `SystemId`, …) so the compiler rejects mixing megawatts with per-unit loading, or a `ZoneId` where a `LineId` is expected. Construct them through the `asX(value)` helpers; the brand is erased at runtime (it is a plain `number`/`string`).

## The `notImplemented` placeholder pattern

Phase 1 ships the full interface surface with placeholder bodies. Every unimplemented method calls `notImplemented(symbol, plannedBehavior, context?)`, which throws `NotImplementedError`:

```ts
public step(context: TickContext): void {
  notImplemented(
    'SimulationEngine.step',
    'Advance one tick: weather → generation → load → power flow → protection → cascade → restoration → director.',
    { context },
  );
}
```

Rules for placeholders:

- The `symbol` is `Type.method`; the `plannedBehavior` describes what a later phase will do.
- Passing `{ context }` keeps parameters "used" under `noUnusedVars` and documents intent.
- `notImplemented` returns `never`, so it satisfies any declared return type (`return notImplemented(...)` for value-returning methods).
- A stack trace during development names exactly what is missing and what it will do.

## Errors

All domain errors extend `GridGuardError` (which reports the concrete subclass name). Specific types: `NotImplementedError`, `InvalidStateTransitionError`, `ContainerResolutionError`. Catch broadly as `GridGuardError`; never throw bare `Error` in domain code.

## Determinism discipline

- **`Math.random()` is banned** in the engine/kernel. All randomness flows through the injected seeded `Rng` (`SystemContext.rng`).
- **Wall-clock time is banned** in the simulation. All time comes from `SimClock` via `TickContext`. This is what makes runs replayable.

## Logging

Pure layers never touch `console` (it is not even in scope for `typecheck:engine`). They accept an injected `Logger`; the default is `NoopLogger`. Concrete sinks (`createConsoleLogger`) live in `@infra`. ESLint `no-console` warns everywhere else.

## TSDoc

Every exported symbol carries a TSDoc comment explaining _why_ it exists, not just what it is. Module barrels open with a docstring stating the module's single responsibility and its allowed imports. Placeholders document their future behavior. This is a deliverable, not a nicety — the docs and the code stay in sync because the intent lives at the definition.

## Testing expectations

- Unit tests co-located as `*.test.ts`; shared fixtures/integration under `tests/`.
- Vitest + v8 coverage; default `node` environment (DOM opt-in per file with `// @vitest-environment jsdom`).
- The deterministic kernel is covered now; the `>90%` engine target ramps as physics lands (see [12](./12-testing-strategy.md)).

## Tooling gate

`pnpm validate` = `typecheck && typecheck:engine && lint && test`. Husky + lint-staged run `eslint --fix` + `prettier` on staged files pre-commit; GitHub Actions runs the full validate on every push. Prettier owns formatting; ESLint (flat, type-checked) owns correctness and boundaries.
