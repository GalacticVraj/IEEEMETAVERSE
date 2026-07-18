# `infrastructure/` — `@infra`

**System F, Infrastructure.** The **composition root** — the one place that wires every DI token to a concrete implementation (bus, logger, serializer, kernel, engine, config) — plus the app `bootstrap` (initialization sequence) and the concrete cross-cutting services (`ConsoleLogger`, `JsonSerializer`). This is the **ONLY layer permitted to import every other layer**; it does wiring, not domain logic, and nothing depends on infrastructure except the app entry point (`main.tsx`).

**May import:** everything — `@config`, `@core`, `@kernel`, `@engine`, `@state`, and any other module needed to assemble the runtime.
**Must not import:** n/a — but it must contain only wiring, never simulation or presentation logic.

**Key files**

- `di/composition-root.ts` — `createCompositionRoot`, binds every token → impl.
- `bootstrap/bootstrap.ts` — `bootstrap(config)` / `AppRuntime`; builds container, resolves bus + kernel, binds projections. Phase 1 deliberately does **not** `boot()`/`tick()` (engine is a placeholder).
- `logging/console-logger.ts`, `serialization/json-serializer.ts` — concrete `Logger` / `Serializer`.

**Phase 1:** **Ready** — real wiring; proves the architecture assembles end-to-end.
