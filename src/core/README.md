# `core/` — `@core`

Kernel primitives and contracts every other layer builds on. This is the **bottom of the dependency graph**: the error hierarchy, the `Result` type, the strongly-typed `EventBus<GridEventMap>` and its grid-event map, the hand-rolled DI `Container` + `createToken`, the cross-cutting DI tokens (`LOGGER`, `SERIALIZER`, `EVENT_BUS`), and the abstract contracts — `Clock`, `Rng`, `Logger`, `Serializer`, and the `SimulationSystem` lifecycle interface. It defines _interfaces and shapes_, never concrete engines; implementations live in `@kernel` and `@infra`. Also home to `notImplemented()` / `NotImplementedError`, the canonical Phase-1 placeholder body.

**May import:** nothing. Zero runtime dependencies, zero framework imports. (Type-only `@app-types` references are the sole exception the tooling allows.)
**Must not import:** anything upward — no `@kernel`/`@engine`, no `react`/`three`/`gsap`/`howler`/`zustand`, no consumer alias (`rendering`/`ui`/`audio`/`state`/`debug`/`infra`/`config`).

**Key files**

- `index.ts` — barrel re-exporting the whole surface.
- `events/event-bus.ts`, `events/grid-events.ts` — typed bus + `GridEventMap`/`GridEventBus`.
- `di/container.ts`, `tokens.ts` — DI container, `Token`, and core service tokens.
- `result/result.ts`, `errors/errors.ts` — `Result`, `GridGuardError`, `NotImplementedError`, `notImplemented()`.
- `clock/clock.ts`, `rng/rng.ts`, `logging/logger.ts`, `serialization/serializer.ts`, `lifecycle/lifecycle.ts` — abstract contracts.

**Phase 1:** **Ready** — real and unit-tested (`event-bus.test.ts`, `container.test.ts`).
