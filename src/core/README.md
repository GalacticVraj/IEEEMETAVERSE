# `core/` — `@core`

Kernel primitives and contracts every other layer builds on. This is the **bottom of the dependency graph**: the error hierarchy, the `Result` type, the production-grade typed `EventBus` (priority/once listeners, `onAny` tracing, stats, payload freezing, leak detection), the domain-agnostic `KernelEventMap` (`SimulationTick`, `KernelStateChanged`) that the domain `GridEventMap` extends, the hand-rolled DI `Container` + `createToken`, the cross-cutting DI tokens (`LOGGER`, `SERIALIZER`, `EVENT_BUS`), and the abstract contracts — `Clock`, `Rng` (with serializable state), `Logger`, `Serializer`, and the generic `SimulationSystem` lifecycle interface. It defines _interfaces and shapes_, never concrete engines; implementations live in `@kernel` and `@infra`. Also home to `notImplemented()` / `NotImplementedError`.

**May import:** nothing. Zero runtime dependencies, zero framework imports. (Type-only `@app-types` references are the sole exception the tooling allows.)
**Must not import:** anything upward — no `@kernel`/`@engine`, no `react`/`three`/`gsap`/`howler`/`zustand`, no consumer alias (`rendering`/`ui`/`audio`/`state`/`debug`/`infra`/`config`).

**Key files**

- `index.ts` — barrel re-exporting the whole surface.
- `events/event-bus.ts` — production `TypedEventBus` + `createEventBus`.
- `events/kernel-events.ts` — `KernelEventMap`, `KERNEL_EVENT`, kernel payloads.
- `events/grid-events.ts` — `GridEventMap` (extends `KernelEventMap`) + `GridEventBus`.
- `di/container.ts`, `tokens.ts` — DI container, `Token`, and core service tokens.
- `result/result.ts`, `errors/errors.ts` — `Result`, `GridGuardError`, `NotImplementedError`, `notImplemented()`.
- `clock/clock.ts`, `rng/rng.ts`, `logging/logger.ts`, `serialization/serializer.ts`, `lifecycle/lifecycle.ts` — abstract contracts.

**Ready** — real and unit-tested (`event-bus.test.ts`, `container.test.ts`).
