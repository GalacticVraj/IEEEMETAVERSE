# 04 · Thermal Physics

Each line carries an **immutable `ThermalState`** that tracks its conductor temperature. Temperature evolves *continuously* across ticks using a first-order RC (thermal lag) model, so a line heats and cools gradually — it never jumps.

## `ThermalState` and `ThermalConfig`

```ts
interface ThermalState {
  line: LineId;
  temperatureC: number;
  config: ThermalConfig;
}

interface ThermalConfig {
  ambientC: number;      // baseline temperature at zero loading
  ratedRiseC: number;    // steady-state rise above ambient at loading = 1.0
  timeConstantS: number; // thermal time constant τ (larger => more inertia)
  warningC: number;      // warning limit
  maxSafeC: number;      // max-safe limit (above this => critical)
}
```

`createThermalState(line, config, initialTemperatureC = config.ambientC)` starts a line at ambient by default.

## The physics

### Steady-state temperature (loading² law)

The temperature a line would eventually reach for a sustained per-unit loading *L*:

```
steadyStateTempC(config, L) = ambientC + ratedRiseC · L²
```

The `L²` term reflects that resistive (`I²R`) heating scales with the square of current. `steadyStateTempC` is a pure function of config and loading — the target the actual temperature relaxes toward.

### First-order RC relaxation (thermal inertia)

Each tick, `stepThermal(thermal, loading, timestepS)` moves the temperature a fraction of the way toward its steady-state target:

```
target   = steadyStateTempC(config, loading)
α        = 1 − exp(−timestepS / timeConstantS)
nextTemp = temp + α · (target − temp)
```

- `α ∈ (0, 1)` is the per-tick relaxation fraction. Small `timestepS` or large `τ` ⇒ small `α` ⇒ slower response (more inertia).
- Because `nextTemp` is only a *fraction* of the way to `target`, **temperature never jumps** — thermal inertia is intrinsic to the model, not bolted on. A step change in loading produces an exponential approach, not an instant change.

### Levels and crossings

`stepThermal` classifies the new temperature into a `ThermalLevel` and reports one-shot crossing flags:

```
level = temperatureC > maxSafeC ? 'critical'
      : temperatureC > warningC ? 'warning'
      : 'normal'
```

| Field | Definition | Fires |
| --- | --- | --- |
| `level` | `'normal'` \| `'warning'` \| `'critical'` | every tick (current classification) |
| `crossedWarning` | `before <= warningC && nextTemp > warningC` | **once**, on the tick temperature first exceeds `warningC` |
| `crossedCritical` | `before <= maxSafeC && nextTemp > maxSafeC` | **once**, on the tick temperature first exceeds `maxSafeC` |

The engine emits `ThermalWarning` / `ThermalCritical` only on those crossing ticks, and feeds `level === 'critical'` to the relay as `thermalCritical` — which triggers an immediate [`'thermal'` trip](./02-relay-lifecycle.md#trip-reasons-tripreason).

## Worked heating example

Using `DEFAULT_THERMAL_CONFIG` (`ambientC 25`, `ratedRiseC 50`, `τ 5`, `warningC 75`, `maxSafeC 90`), a line starting at ambient and then sustaining **loading L = 1.3** with **timestepS = 1 s**:

- **Steady-state target:** `25 + 50 · 1.3² = 25 + 50 · 1.69 = 109.5 °C` (well above the 90 °C max-safe limit).
- **Relaxation fraction:** `α = 1 − exp(−1/5) = 1 − exp(−0.2) ≈ 0.18127`.
- **Recurrence:** `Tₙ₊₁ = 0.81873 · Tₙ + 19.849`.

| Step | Temperature after step (°C) | Level | Crossing |
| --- | --- | --- | --- |
| start | 25.00 | normal | — |
| 1 | 40.32 | normal | — |
| 2 | 52.86 | normal | — |
| 3 | 63.13 | normal | — |
| 4 | 71.54 | normal | — |
| 5 | 78.42 | **warning** | `crossedWarning` |
| 6 | 84.06 | warning | — |
| 7 | 88.67 | warning | — |
| 8 | 92.46 | **critical** | `crossedCritical` |

At step 8 the temperature passes `maxSafeC` (90 °C). On that same tick the engine sets `thermalCritical = true` for the relay, so the relay issues a `'thermal'` trip immediately — the line heats gradually but trips the instant it becomes unsafe. Cooling follows the same exponential law in reverse once loading drops and the target falls back toward ambient.

> The exact crossing ticks depend on `timestepS` and `τ`. The shape — a smooth exponential approach that never overshoots the loading² target — is always the same.
