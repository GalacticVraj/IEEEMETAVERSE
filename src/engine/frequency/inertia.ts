/**
 * Rotational inertia accounting.
 *
 * A synchronous machine stores kinetic energy in its spinning mass; that
 * energy is what resists a frequency change in the instant after a generation
 * or load imbalance. The inertia constant H is that stored energy expressed in
 * seconds: H = E_kinetic / S_rated. A machine with H = 5 s holds enough
 * kinetic energy to supply its full rating for 5 seconds.
 *
 * The point of this module: inverter-coupled plant (solar, wind, batteries)
 * has NO rotating mass synchronised to the grid and therefore contributes
 * ZERO inertia. As renewables displace thermal plant, system inertia falls and
 * the same MW loss produces a much faster frequency collapse. That is the
 * defining stability problem of modern power systems, and here it is emergent
 * rather than scripted.
 *
 * Typical values follow standard machine data (Kundur, "Power System Stability
 * and Control", Table 3.2): large steam ~4-6 s, gas turbines ~3-5 s.
 */

/** Inertia constant H in seconds, by generator kind. */
export const INERTIA_CONSTANTS_S: Readonly<Record<string, number>> = {
  Baseload: 5.0,
  Peaker: 4.0,
  /**
   * The interconnect is not a local machine, but a stiff AC tie couples this
   * system to the neighbouring one's rotating mass. 3.0 s represents the
   * effective inertia the tie contributes at Meridian Bay's scale.
   */
  Import: 3.0,
  Solar: 0,
  Wind: 0,
  Storage: 0,
};

/** System MVA base — the sum of installed capacity at Meridian Bay. */
export const SYSTEM_MVA_BASE = 1150;

export interface MachineInertiaInput {
  readonly kind: string;
  readonly ratedMw: number;
  /** False when tripped or otherwise disconnected. */
  readonly online: boolean;
}

/** True when the machine's rotating mass is synchronised to grid frequency. */
export function isSynchronous(kind: string): boolean {
  return (INERTIA_CONSTANTS_S[kind] ?? 0) > 0;
}

/**
 * Total stored kinetic energy available to resist frequency change, in MW·s
 * (equivalently H_sys · S_base). Only online synchronous machines count.
 */
export function systemInertiaMwS(machines: readonly MachineInertiaInput[]): number {
  let total = 0;
  for (const machine of machines) {
    if (!machine.online) continue;
    total += (INERTIA_CONSTANTS_S[machine.kind] ?? 0) * machine.ratedMw;
  }
  return total;
}
