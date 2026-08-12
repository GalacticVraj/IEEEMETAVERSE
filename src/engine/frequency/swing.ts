/**
 * The swing equation — how system frequency actually moves.
 *
 *     df/dt = f0 / (2 * H_sys * S_base) * (P_mech - P_elec - D * df)
 *
 * Frequency is the *integral* of imbalance, not a function of it. That single
 * distinction is what this module exists to restore: a deficit does not park
 * frequency at a lower value, it drives frequency downward continuously until
 * something arrests it. The rate of that fall (RoCoF) is inversely
 * proportional to stored kinetic energy, which is why inertia matters.
 *
 * `D` is load self-regulation: real load (motors especially) draws less power
 * as frequency falls, which partially offsets a deficit. ~1 %/Hz of system
 * load is the conventional figure.
 *
 * Integration is explicit Euler at the kernel's fixed timestep. At 100 ms with
 * a system time constant of seconds this is stable and exactly reproducible,
 * which matters more here than higher-order accuracy: replay must stay
 * bit-identical.
 */

export const NOMINAL_HZ = 60;
/** Below this the system has collapsed; no useful dynamics remain. */
export const MIN_HZ = 55;
export const MAX_HZ = 65;

/** Load self-regulation, ~1 %/Hz of the 1150 MW base. */
export const LOAD_DAMPING_MW_PER_HZ = 19;

export interface SwingInput {
  /** Frequency at the start of this step, Hz. */
  readonly frequencyHz: number;
  /** Mechanical power delivered by prime movers, MW. */
  readonly mechanicalMw: number;
  /** Electrical power drawn by served load, MW. */
  readonly electricalMw: number;
  /** Stored kinetic energy of online synchronous machines, MW·s. */
  readonly inertiaMwS: number;
  /** Fixed timestep, seconds. */
  readonly timestepS: number;
}

export interface SwingResult {
  readonly frequencyHz: number;
  /** Rate of change of frequency, Hz/s. The size of a loss shows up here. */
  readonly rocofHzPerS: number;
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/** One fixed-step integration of the swing equation. Pure. */
export function stepSwing(input: SwingInput): SwingResult {
  // With no synchronous machines online there is no rotating mass defining
  // frequency at all — the system has collapsed rather than slowed.
  if (input.inertiaMwS <= 0) {
    return { frequencyHz: MIN_HZ, rocofHzPerS: 0 };
  }

  const deviationHz = input.frequencyHz - NOMINAL_HZ;
  const netMw = input.mechanicalMw - input.electricalMw - LOAD_DAMPING_MW_PER_HZ * deviationHz;

  const rocofHzPerS = (NOMINAL_HZ * netMw) / (2 * input.inertiaMwS);
  const frequencyHz = clamp(input.frequencyHz + rocofHzPerS * input.timestepS, MIN_HZ, MAX_HZ);

  return { frequencyHz, rocofHzPerS };
}
