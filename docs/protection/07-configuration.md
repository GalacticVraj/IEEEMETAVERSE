# 07 · Configuration

All protection behaviour is driven by three immutable config objects: `RelayConfig`, `ThermalConfig`, and `BreakerConfig`. Thresholds are **per-unit line loading**; delays are in **simulated seconds**. Defaults come from the shared simulation constants and are validated before use (see [08 · Validation](./08-validation.md)).

## `RelayConfig`

| Field | Type | Meaning |
| --- | --- | --- |
| `warningThreshold` | number | loading at which the line is flagged as approaching overload |
| `pickupThreshold` | number | loading at/above which the relay picks up and starts timing |
| `tripThreshold` | number | nominal trip loading (ordering reference) |
| `emergencyThreshold` | number | upper ordering bound for thresholds |
| `tripDelayS` | number | base definite-time delay, and the reference for inverse-time |
| `instantaneousTrip` | boolean | enables the no-timing instantaneous trip |
| `instantaneousThreshold` | number | loading at/above which an instantaneous trip fires |
| `resetRatio` | number | drop-out threshold as a fraction of pickup |
| `resetDelayS` | number | seconds in `Resetting` before returning to `Monitoring` |
| `curve` | `ProtectionCurveType` | which [trip-delay curve](./05-protection-curves.md) times the trip |
| `coordinationDelayS` | number | extra delay applied to **backup** relays for selectivity |
| `role` | `RelayRole` | `'primary'` or `'backup'` |

`RelayRole = 'primary' | 'backup'`.

## `ThermalConfig`

| Field | Type | Meaning |
| --- | --- | --- |
| `ambientC` | number | baseline temperature at zero loading |
| `ratedRiseC` | number | steady-state rise above ambient at loading = 1.0 |
| `timeConstantS` | number | thermal time constant τ (larger ⇒ more inertia) |
| `warningC` | number | warning limit |
| `maxSafeC` | number | max-safe limit; above it the line is `critical` |

See [04 · Thermal Physics](./04-thermal-physics.md) for how these drive the RC model.

## `BreakerConfig`

| Field | Type | Meaning |
| --- | --- | --- |
| `operateTicks` | number | ticks the breaker takes to travel open or closed |

## Defaults

### `DEFAULT_RELAY_CONFIG`

| Field | Default | Notes |
| --- | --- | --- |
| `warningThreshold` | `0.9` | |
| `pickupThreshold` | `1.0` | `= OVERLOAD_THRESHOLD_PU` |
| `tripThreshold` | `1.25` | `= TRIP_THRESHOLD_PU` |
| `emergencyThreshold` | `1.5` | |
| `tripDelayS` | `2` | seconds |
| `instantaneousTrip` | `true` | |
| `instantaneousThreshold` | `1.5` | instant trip at/above 1.5 pu |
| `resetRatio` | `0.95` | dropout below `0.95 × pickup` |
| `resetDelayS` | `1` | second |
| `curve` | `InverseTime` | `ProtectionCurveType.InverseTime` |
| `coordinationDelayS` | `0.5` | applied only to backups |
| `role` | `'primary'` | |

### `DEFAULT_THERMAL_CONFIG`

| Field | Default | Notes |
| --- | --- | --- |
| `ambientC` | `25` | °C |
| `ratedRiseC` | `50` | ⇒ steady-state **75 °C at rated loading** (`25 + 50·1²`) |
| `timeConstantS` | `5` | τ |
| `warningC` | `75` | °C |
| `maxSafeC` | `90` | °C |

### `DEFAULT_BREAKER_CONFIG`

| Field | Default | Notes |
| --- | --- | --- |
| `operateTicks` | `1` | one tick to open or close |

## Threshold ordering

The defaults satisfy the ordering the validator enforces:

```
warning (0.9) ≤ pickup (1.0) ≤ trip (1.25) ≤ emergency (1.5)
instantaneous (1.5) ≥ pickup (1.0)
thermal: warning (75) < maxSafe (90),  maxSafe (90) > ambient (25)
```

Any config that violates these is rejected before it runs — see [08 · Validation](./08-validation.md).
