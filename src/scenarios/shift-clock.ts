/**
 * shift-clock.ts — one place that knows how long a shift is.
 *
 * Every scenario except the heatwave was written against a ~100-tick arc and
 * never re-choreographed when the run became 1,800 ticks. "Coastal Storm"
 * fired lightning at tick 30, flashover at 50 and lost the wind farm at 80 —
 * T+0:03, T+0:05 and T+0:08 of a three-minute shift. The whole scenario was
 * over before the intro camera had finished landing, and the remaining 2:52
 * was an empty grid.
 *
 * These helpers make the intended beat readable at the call site: `at(0, 30)`
 * is T+0:30, not "tick 300, trust me".
 */

/** Ticks per simulated second. The kernel runs at 10 Hz. */
export const TICKS_PER_SECOND = 10;

/** A full shift, in ticks — mirrors `RUN_TICKS` in the weather model. */
export const SHIFT_TICKS = 1800;

/** Tick at T+mm:ss. */
export function at(minutes: number, seconds: number): number {
  return (minutes * 60 + seconds) * TICKS_PER_SECOND;
}

/**
 * Progress 0..1 through a ramp that starts at `fromTick` and lasts
 * `durationTicks`. Clamped, so a caller can evaluate it on every tick without
 * guarding the edges — which is how a scenario scripts a smooth weather event
 * (cloud cover arriving over ninety seconds) rather than a step change.
 */
export function ramp(tick: number, fromTick: number, durationTicks: number): number {
  if (durationTicks <= 0) return tick >= fromTick ? 1 : 0;
  const t = (tick - fromTick) / durationTicks;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Linear interpolation, for ramping a weather arc field between two values. */
export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}
