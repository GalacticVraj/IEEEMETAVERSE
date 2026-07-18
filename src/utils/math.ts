/**
 * Pure numeric helpers used across the simulation. No side effects, no globals —
 * safe for the engine-standalone typecheck.
 */

/** Clamp `value` into the inclusive `[min, max]` range. */
export const clamp = (value: number, min: number, max: number): number => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

/** Linear interpolation from `a` to `b` by fraction `t` (unclamped). */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Inverse of {@link lerp}: the fraction of `value` between `a` and `b`. */
export const inverseLerp = (a: number, b: number, value: number): number => {
  if (a === b) return 0;
  return (value - a) / (b - a);
};

/** Re-map `value` from the `[inMin,inMax]` range to `[outMin,outMax]`. */
export const remap = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number => lerp(outMin, outMax, inverseLerp(inMin, inMax, value));

/** True when `a` and `b` are within `epsilon` of each other. */
export const approxEqual = (
  a: number,
  b: number,
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers -- default float tolerance
  epsilon = 1e-9,
): boolean => Math.abs(a - b) <= epsilon;
