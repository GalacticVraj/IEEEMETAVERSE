# 07 · Module Interaction

How the modules cooperate at **runtime** (not just at compile time). The composition root wires everything once; from then on all cross-module communication happens through the event bus and through injected interfaces — never through direct imports across the pure/consumer boundary.

## Runtime collaboration map

```mermaid
flowchart TB
    INFRA["@infra\ncomposition root + bootstrap"]

    subgraph Kernel["@kernel"]
        K["SimulationKernel"]
        CLOCK["SimClock"]
        RNG["xoroshiro128+ RNG"]
        FSM["KernelLifecycle FSM"]
        REG["SystemRegistry"]
        SCHED["Scheduler"]
    end

    BUS(["GridEventBus (@core)"])

    subgraph Engine["@engine — System A"]
        ENG["SimulationEngine facade"]
        SUBS["weather · generation · load · powerflow\nprotection · cascade · restoration · director"]
    end

    SCEN["@scenarios\nICrisisScenario + registry"]
    LEARN["@learning — System B"]
    REPLAY["@replay"]
    ETHICS["@ethics"]
    STATE["@state\nprojections"]

    subgraph Consumers["Consumers"]
        RENDER["@rendering"]
        UI["@ui"]
        AUDIO["@audio"]
        DEBUG["@debug"]
    end

    INFRA -->|register/resolve tokens| K
    INFRA -->|register/resolve tokens| ENG
    INFRA -->|register scenario| SCEN
    INFRA -->|bindStores| STATE

    K --> CLOCK
    K --> RNG
    K --> FSM
    K --> REG
    K --> SCHED
    K -->|owns/exposes| BUS
    FSM -->|bridged as KernelStateChanged| BUS

    REG --> ENG
    SCHED -->|step each tick| ENG
    ENG --> SUBS
    SCEN -->|setup/onTick| ENG
    ENG -->|reads| ETHICS
    SUBS -->|emit| BUS

    BUS -->|subscribe| STATE
    BUS -->|subscribe| LEARN
    BUS -->|subscribe/record| REPLAY
    LEARN -->|LearningUpdated| BUS

    STATE --> RENDER
    STATE --> UI
    STATE --> AUDIO
    STATE --> DEBUG
    UI -->|DecisionCommitted| BUS
```

## Who talks to whom, and how

| From          | To                                | Channel                          | Notes                                                                            |
| ------------- | --------------------------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| `@infra`      | all layers                        | direct import + DI token binding | The only layer allowed to import everything; wiring only, no logic.              |
| `@kernel`     | `@engine` (as `SimulationSystem`) | `registry` + `scheduler.step`    | Kernel drives systems by interface; knows no physics.                            |
| `@kernel` FSM | consumers                         | `KernelStateChanged` on the bus  | Kernel bridges every validated FSM change onto the bus.                          |
| `@scenarios`  | `@engine`                         | `ICrisisScenario.setup/onTick`   | Scenario scripts the engine via its facade; engine core never imports scenarios. |
| `@engine`     | `@ethics`                         | direct import (upstream)         | Ethics is pure data consumed by the engine; never the reverse.                   |
| `@engine`     | everyone                          | events on the bus                | The only way authoritative state leaves the engine.                              |
| `@state`      | `@engine` events                  | `bindStores(bus)` subscriptions  | Copies payloads into projections; no computation.                                |
| consumers     | `@state`                          | Zustand hooks                    | Read-only reactive reads.                                                        |
| consumers     | `@engine`                         | **none**                         | Blocked by ESLint boundary + typecheck:engine.                                   |
| `@ui`         | `@engine`                         | `DecisionCommitted` on the bus   | User intent flows forward as an event; the engine decides the effect.            |
| `@learning`   | consumers                         | `LearningUpdated` on the bus     | Learning observes events only; never imports the engine.                         |
| `@replay`     | the run                           | records/replays the event stream | `seed + events` reproduces a run bit-for-bit.                                    |

## Wiring vs. running

There are two distinct phases of interaction:

### Wiring (once, at bootstrap)

`createCompositionRoot(config)` registers every token → concrete implementation in the DI container:

- **Real:** `CONFIG_SERVICE`, `LOGGER`, `SERIALIZER`, `EVENT_BUS`, `SIMULATION_KERNEL`, `SCENARIO_REGISTRY` (+ `HeatwaveScenario`).
- **Placeholders:** every `@engine` subsystem (`TOPOLOGY_SERVICE`, `WEATHER_MODEL`, `POWER_FLOW_SOLVER`, `PROTECTION_SYSTEM`, `CASCADE_ENGINE`, `RESTORATION_CONTROLLER`, `DIRECTOR`, `SIMULATION_ENGINE`, …), all of `@learning`, `@ethics`, `@replay`, `@audio`, `@debug`, `@workers`.

Swapping a placeholder for a real implementation later is a **one-line change** at the composition root; nothing else depends on the concrete type.

### Running (every tick / every event)

Once bound, no module reaches across boundaries by name. The engine emits, `@state` projects, consumers render — all through the bus and the injected interfaces. This is what makes the system open for extension (add a scenario, add a consumer) but closed to accidental coupling.

## Example: a line trips

```mermaid
sequenceDiagram
    autonumber
    participant K as Kernel
    participant PROT as engine · protection
    participant BUS as GridEventBus
    participant ST as @state
    participant RN as @rendering
    participant AU as @audio
    participant LN as @learning

    K->>PROT: step(tickContext)
    PROT->>PROT: loading ≥ TRIP_THRESHOLD_PU
    PROT-->>BUS: LineTripped { line, cause }
    BUS-->>ST: project line status
    BUS-->>RN: flash + de-energise line mesh
    BUS-->>AU: play trip SFX
    BUS-->>LN: attribute cause for scoring
```

One authoritative fact, emitted once, consumed independently by four modules — none of which can touch the engine directly.
