# Phase 5 — Protection System Architecture

**GridGuard v3 · Protection Engine Reference**
Date: 2026-07-18 | Status: Complete | Scope: Phase 5 only

---

## 1. Overview

Phase 5 adds a deterministic Protection Engine on top of the frozen Phase 1–4 layers (Simulation Kernel, Electrical Graph, DC Power Flow Solver). It models how a real transmission network detects abnormal operating conditions and safely disconnects equipment.

**Hard constraints (never violated):**
- Protection never performs power flow calculations.
- Protection never mutates topology directly.
- Topology mutations happen exclusively through controlled graph transactions.
- No cascading failure logic, no load shedding, no restoration.

---

## 2. Protection Architecture

```
Power Flow Result
      │
      ▼
┌─────────────────────────────┐
│     Protection Engine       │  ← evaluate(context) each tick
│                             │
│  ┌──────────┐  ┌─────────┐  │
│  │  Relay   │  │ Thermal │  │  Per-line state machines
│  │  (FSM)   │  │  Model  │  │  (immutable, pure)
│  └────┬─────┘  └────┬────┘  │
│       │              │       │
│  ┌────▼─────┐        │       │
│  │ Breaker  │◄───────┘       │  Command: open | close | lock | none
│  │  (FSM)   │               │
│  └────┬─────┘               │
└───────┼─────────────────────┘
        │  reachedOpen = true
        ▼
  graph.mutate(tx ⇒ tx.removeLine(…))   ← ONLY topology mutation
        │
        ▼
  Events emitted via TypedEventBus<ProtectionEventMap>
```

**Pipeline per tick (deterministic order):**
1. Power Flow (Phase 4 solver — runs externally)
2. Protection Evaluation: `engine.evaluate(context)`
   a. Thermal update for every line
   b. Relay logic step
   c. Breaker command + mechanics
3. Graph transaction (if any breaker reached Open)
4. Events emitted
5. Power Flow — next tick

---

## 3. Relay Architecture

### 3.1 Relay States

```
           ┌──────────┐
   start   │   Idle   │
  ────────► │          │
           └────┬─────┘
                │ any condition observed
                ▼
          ┌───────────┐
          │ Monitoring │◄────────────────┐
          └─────┬──────┘                 │
                │ loading ≥ pickup        │ reset delay elapsed
                ▼                         │
           ┌────────┐                    │
           │ Pickup │                    │
           └───┬────┘                    │
               │ timing starts           │
               ▼                         │
          ┌─────────┐                   │
          │  Timing  │──► dropout ──────►│
          └────┬─────┘              ┌───┴──────┐
               │ delay elapsed      │ Resetting │
               ▼                    └───────────┘
         ┌───────────┐
         │TripPending│ (reserved for future multi-phase trips)
         └─────┬─────┘
               │
               ▼
         ┌────────────┐
         │ TripIssued │
         └─────┬──────┘
               │ next tick
               ▼
         ┌──────────┐
         │ LockedOut │  ← permanent until operator reset
         └──────────┘

  ┌──────────┐   ┌──────────┐
  │ Disabled │   │ LockedOut│  ← absorbing states; no transitions
  └──────────┘   └──────────┘
```

### 3.2 Relay State Fields

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique relay identifier |
| `line` | `LineId` | Associated transmission line |
| `phase` | `RelayPhase` | Current FSM state |
| `config` | `RelayConfig` | Thresholds, delays, curve, role |
| `lastPickupTick` | `number \| null` | Tick when last pickup occurred |
| `lastTripTick` | `number \| null` | Tick when last trip was issued |
| `timingStartedTick` | `number \| null` | Tick when trip timing began |
| `resetStartedTick` | `number \| null` | Tick when reset delay started |
| `operationCount` | `number` | Total trip operations |
| `health` | `RelayHealth` | `healthy \| degraded \| failed` |

### 3.3 Trip Reasons

| Reason | Trigger |
|---|---|
| `instantaneous` | `loading ≥ instantaneousThreshold` (no timing) |
| `timed` | Delay elapsed while loading ≥ pickup threshold |
| `thermal` | `thermalCritical = true` (temperature > maxSafeC) |

---

## 4. Breaker Architecture

### 4.1 Breaker States

```
  ┌────────┐  open cmd   ┌─────────┐  elapsed ≥ operateTicks  ┌──────┐
  │ Closed │────────────►│ Opening │─────────────────────────►│ Open │
  └────────┘             └─────────┘                          └──┬───┘
      ▲                                                           │
      │                  ┌─────────┐                 close cmd   │
      └──────────────────│ Closing │◄──────────────────────────── ┘
        elapsed ≥ ticks  └─────────┘

  ┌────────┐   lock cmd
  │ Closed │────────────► ┌────────┐  (absorbing — no further transitions)
  │Opening │              │ Locked │
  │ Open   │              └────────┘
  └────────┘

  ┌─────────────┐  ┌────────┐  (external mechanisms only — absorbing)
  │ Maintenance │  │Faulted │
  └─────────────┘  └────────┘
```

### 4.2 Command Pipeline

```
Relay Decision (trip=true)
        │
        ▼
BreakerCommand = 'open'
        │
        ▼
stepBreaker() → BreakerStepResult
        │
        ├── reachedOpen = false  →  (still transitioning)
        │
        └── reachedOpen = true   →  graph.mutate(tx ⇒ tx.removeLine(lineId))
                                          └── graph.version increments
                                          └── BreakerOpened event emitted
```

---

## 5. Thermal Model

### 5.1 Physics

The thermal model uses a **first-order RC exponential relaxation** (the industry-standard IEC 60287 approximation):

```
T(t+Δt) = T(t) + α · (T_ss − T(t))
```

Where:
- `α = 1 − exp(−Δt / τ)` (Euler discretisation of the continuous RC response)
- `T_ss = T_ambient + ratedRise · L²` (steady-state temperature at loading L)
- `τ` = thermal time constant (seconds)

**Key properties:**
- Temperature **never jumps** — thermal inertia is structurally enforced by the model.
- Loading squared reflects I²R heating (ohmic losses scale with current squared).
- Cooling toward ambient is automatic when loading drops.

### 5.2 Thermal Levels

| Level | Condition |
|---|---|
| `normal` | T ≤ warningC |
| `warning` | warningC < T ≤ maxSafeC |
| `critical` | T > maxSafeC → triggers relay thermal trip |

### 5.3 Default Parameters

| Parameter | Default | Meaning |
|---|---|---|
| `ambientC` | 25°C | Baseline ambient temperature |
| `ratedRiseC` | 50°C | Rise at rated current (L=1.0) → steady-state 75°C |
| `timeConstantS` | 5 s | RC time constant |
| `warningC` | 75°C | Warning threshold |
| `maxSafeC` | 90°C | Maximum safe (trip) threshold |

---

## 6. Protection Curves

Protection trip delay curves implement the `ProtectionCurve` interface:

```typescript
interface ProtectionCurve {
  readonly type: ProtectionCurveType;
  tripDelayS(loading: number, config: RelayConfig): number;
}
```

**New curves are registered in `PROTECTION_CURVES` — the engine never changes.**

| Curve | Behaviour |
|---|---|
| `Instantaneous` | Always 0 delay |
| `DefiniteTime` | Fixed `tripDelayS` regardless of loading |
| `InverseTime` | `tripDelayS / (loading/pickup − 1)`, capped at `100×tripDelayS` (IEEE-style placeholder) |
| `ThermalDelay` | `(2 × tripDelayS) / (loading/pickup)`, floor at `1e-6` to prevent division by zero |

---

## 7. Protection Coordination

Selectivity is achieved through **coordination delay** on backup relays:

```
Primary relay:   trips at elapsed ≥ tripDelayS
Backup relay:    trips at elapsed ≥ tripDelayS + coordinationDelayS
```

- `role: 'primary'` — no coordination offset
- `role: 'backup'` — adds `coordinationDelayS` to trip threshold

This ensures only the closest relay to the fault operates; the backup only trips if the primary fails to clear the fault within the coordination window.

---

## 8. Events

All events extend `ProtectionEventMap extends KernelEventMap`. Every payload is a documented interface.

| Event | Payload | Fired When |
|---|---|---|
| `RelayMonitoring` | `RelayEventPayload` | Relay transitions Idle → Monitoring |
| `RelayPickup` | `RelayEventPayload` | Loading ≥ pickup threshold |
| `RelayTiming` | `RelayEventPayload` | Relay re-picks up from Resetting |
| `RelayReset` | `RelayEventPayload` | Reset delay elapsed, back to Monitoring |
| `RelayTripIssued` | `RelayTripPayload` | Trip decision made (includes `reason`) |
| `RelayLockedOut` | `RelayEventPayload` | Relay locks out after TripIssued |
| `BreakerOpening` | `BreakerEventPayload` | Breaker begins opening travel |
| `BreakerOpened` | `BreakerEventPayload` | Breaker fully open; topology mutation follows |
| `BreakerClosing` | `BreakerEventPayload` | Breaker begins closing travel |
| `BreakerClosed` | `BreakerEventPayload` | Breaker fully closed |
| `BreakerLocked` | `BreakerEventPayload` | Breaker locked |
| `ThermalWarning` | `ThermalEventPayload` | Temperature first crosses warningC |
| `ThermalCritical` | `ThermalEventPayload` | Temperature first crosses maxSafeC |
| `ProtectionDecision` | `ProtectionDecisionPayload` | One decision per relay per tick (trip or no-trip) |
| `ProtectionEvaluationCompleted` | `ProtectionEvaluationCompletedPayload` | End of evaluation cycle |

---

## 9. Validation

Two validation functions provide structured reports — **never silently repair**.

### `validateProtectionConfig(relay, thermal, breaker)`
Validates configuration before runtime:

| Code | Meaning |
|---|---|
| `INVALID_THRESHOLD` | Threshold ordering violation or instantaneous < pickup |
| `INVALID_CONFIG` | Reset ratio out of (0,1], negative rated rise |
| `IMPOSSIBLE_TIMING` | Negative delays, non-positive time constant |
| `NEGATIVE_TEMPERATURE` | Ambient below absolute zero (−273.15°C) |

### `validateProtectionState(engine)`
Validates live engine state:

| Code | Meaning |
|---|---|
| `MISSING_BREAKER` | Relay references a line with no breaker |
| `INVALID_CONFIG` | Thermal state has NaN temperature |
| `NEGATIVE_TEMPERATURE` | Temperature below absolute zero |
| `THERMAL_OVERFLOW` | Temperature exceeds 10 000°C |

---

## 10. Diagnostics

`protectionDiagnostics(engine)` returns a `ProtectionDiagnostics` snapshot:

```typescript
interface ProtectionDiagnostics {
  relayCount: number;
  breakerCount: number;
  lockedOutRelays: number;
  openBreakers: number;
  totalOperations: number;
  hottestC: number;
  relays: RelayDiagnostic[];
  breakers: BreakerDiagnostic[];
  thermals: ThermalDiagnostic[];
}
```

`formatProtectionDiagnostics(diag)` produces a one-line console summary.

> **Debug mode only.** These functions are not called in the hot path.

---

## 11. Configuration Reference

### RelayConfig

```typescript
interface RelayConfig {
  warningThreshold:       number;   // default 0.90 pu
  pickupThreshold:        number;   // default 1.00 pu
  tripThreshold:          number;   // default 1.25 pu
  emergencyThreshold:     number;   // default 1.50 pu
  tripDelayS:             number;   // default 2 s
  instantaneousTrip:      boolean;  // default true
  instantaneousThreshold: number;   // default 1.50 pu
  resetRatio:             number;   // default 0.95 (fraction of pickup)
  resetDelayS:            number;   // default 1 s
  curve:                  ProtectionCurveType; // default InverseTime
  coordinationDelayS:     number;   // default 0.5 s (backup relays only)
  role:                   'primary' | 'backup'; // default 'primary'
}
```

### ThermalConfig

```typescript
interface ThermalConfig {
  ambientC:      number;  // default 25°C
  ratedRiseC:    number;  // default 50°C (rise at L=1.0)
  timeConstantS: number;  // default 5 s
  warningC:      number;  // default 75°C
  maxSafeC:      number;  // default 90°C
}
```

### BreakerConfig

```typescript
interface BreakerConfig {
  operateTicks: number;   // default 1 (ticks to travel open or closed)
}
```

---

## 12. Extension Guide

### Adding a new protection curve

1. Add a new value to `ProtectionCurveType` in `config.ts`.
2. Implement `ProtectionCurve` with `type` and `tripDelayS(loading, config)`.
3. Register it in `PROTECTION_CURVES` in `curves.ts`.
4. Done — no changes to the relay engine or breaker.

### Adding relay health degradation

1. Extend `RelayHealth` to include new states.
2. Add transition logic in `stepRelay()`.
3. Emit a new event (add to `ProtectionEventMap`).

### Supporting multiple breakers per line

1. Change `ProtectionEngine` internals to `Map<LineId, ProtectionBreaker[]>`.
2. Update `evaluate()` to iterate per-line breaker array.
3. Topology mutation fires when **all** breakers on a line reach Open.

---

## 13. Phase 5 Exit Criteria Status

| Criterion | Status |
|---|---|
| Protection engine compiles independently (`tsconfig.engine.json`) | ✅ |
| Relays evaluate deterministically | ✅ |
| Breakers execute correctly | ✅ |
| Thermal model behaves realistically (RC exponential) | ✅ |
| Protection coordination works (primary < backup) | ✅ |
| Graph mutations occur only through transactions | ✅ |
| Events are emitted correctly (typed, payloaded) | ✅ |
| Documentation generated | ✅ |
| Tests pass — 259/259 | ✅ |
| Coverage ≥ 95% on engine/protection | ✅ **100% statements/branches/lines** |

---

## 14. Recommendations Before Phase 6

1. **Implement `TripPending` state** — currently reserved in the FSM enum but never entered. Phase 6 (cascading) may need multi-step trip sequences where a relay pauses before issuing the final command.

2. **Add relay reclosing / auto-reclose** — real transmission relays attempt to reclose after a transient fault. This is the natural inverse of the current lockout flow and should be modelled in Phase 6.

3. **Implement multiple breakers per line** — real lines have breakers at both ends. This affects isolation logic and should be in place before cascading failure is modelled.

4. **Add `health` degradation logic** — `RelayHealth` (`healthy | degraded | failed`) is modelled but never mutated. Phase 6 aging/weather interactions should drive this.

5. **Per-relay configuration** — currently all relays on a grid share one `RelayConfig`. Production grids have individually tuned relays; Phase 6 should accept a config factory `(lineId) => RelayConfig`.

6. **Wire the protection engine into the Simulation Kernel scheduler** — currently `evaluate()` is called manually in tests. Phase 6 should register the protection engine as a scheduled system so the tick pipeline is automated.

7. **Expose `validateProtectionState` in the bootstrap** — run it after registration and surface warnings through the diagnostic bus before the first tick.
