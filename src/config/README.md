# `config/` — `@config`

Every configurable parameter, in one place, organized into four runtime **profiles** — `development`, `demo`, `production`, `competition` — each a fully-resolved `AppConfig` (simulation seed/timestep/tick-rate, render settings, debug/log level). **No hardcoded tunable lives outside this module.** The `ConfigService` selects and exposes the active profile; `@infra` loads it and injects the result, so the pure layers never import config directly. Real data, not a placeholder — these are the actual values the app runs with (e.g. fixed seeds `1`/`42`/`7` for repeatable and judged runs).

**May import:** `@constants`, `@app-types` (for typed tunables/units).
**Must not import:** `@engine`, `@kernel`, or any consumer — config is data, injected downward by `@infra`.

**Key files**

- `schema.ts` — `AppConfig`, `AppProfile`, `SimulationConfig`/`RenderConfig`/`DebugConfig`, `LogLevel`.
- `profiles.ts` — the concrete `PROFILES` record (the real tunables).
- `config-service.ts` — `ConfigService` that resolves the active profile.

**Phase 1:** **Ready** — real profiles + service (tested in `config-service.test.ts`).
