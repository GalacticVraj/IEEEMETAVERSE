# `workers/` — `@workers`

The **stubbed simulation-offload boundary**. It defines the typed message contract between the main thread and a future simulation web worker (`WorkerRequest` / `WorkerResponse`) and a bridge abstraction, so the rest of the app talks to a bridge whose _implementation_ can move from the main thread (Phase 1) to a real `Worker` (a later phase) **without changing any caller**. Decided in the spec: worker contract stubbed now, sim runs main-thread in Phase 1.

**May import:** `@core`, `@app-types`.
**Must not import:** any consumer or framework; the contract must stay serialization-safe (plain messages cross the worker boundary).

**Key files**

- `messages.ts` — `WorkerRequest` (`boot`/`tick`/`dispose`) and `WorkerResponse` (`booted`/`tick-complete`/`error`).
- `worker-bridge.ts` — bridge abstraction over the execution context.
- `simulation.worker.ts` — worker entry stub for the later phase.

**Phase 1:** **Placeholder** — contract + bridge stub; runs main-thread, no worker spawned yet.
