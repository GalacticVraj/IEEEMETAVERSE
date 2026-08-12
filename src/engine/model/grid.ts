import type {
  GenerationKind,
  GeneratorId,
  Hertz,
  LineId,
  LineState,
  LoadId,
  MegaWatts,
  NodeId,
  PerUnit,
  ZoneId,
  ZoneState,
} from '@app-types';

import type { SecurityVerdict } from '../frequency';

/*
 * ---------------------------------------------------------------------------
 * Static electrical topology — the wiring diagram. Immutable for a given
 * scenario; describes WHAT exists, not its current condition.
 * ---------------------------------------------------------------------------
 */

export interface GridNode {
  readonly id: NodeId;
  readonly zone: ZoneId;
}

export interface PowerLine {
  readonly id: LineId;
  readonly from: NodeId;
  readonly to: NodeId;
  /** Thermal transfer rating. */
  readonly capacity: MegaWatts;
  /** Series reactance in per-unit (drives DC/AC power flow). */
  readonly reactance: PerUnit;
}

export interface Generator {
  readonly id: GeneratorId;
  readonly node: NodeId;
  readonly kind: GenerationKind;
  readonly capacity: MegaWatts;
}

export interface Load {
  readonly id: LoadId;
  readonly node: NodeId;
  readonly zone: ZoneId;
  readonly nominalDemand: MegaWatts;
  /** Critical loads (e.g. hospital) must never be shed. */
  readonly critical: boolean;
}

export interface Appliance {
  id: string;
  name: string;
  category: 'ac' | 'ev_charger' | 'water_heater' | 'lighting' | 'refrigeration';
  wattage: number;
  isOn: boolean;
}

export interface BuildingApplianceState {
  buildingId: string;
  appliances: Appliance[];
}

export interface Zone {
  readonly id: ZoneId;
  readonly name: string;
  readonly buildingIds: string[];
}

export interface GridTopology {
  readonly nodes: readonly GridNode[];
  readonly lines: readonly PowerLine[];
  readonly generators: readonly Generator[];
  readonly loads: readonly Load[];
  readonly zones: readonly Zone[];
}

/*
 * ---------------------------------------------------------------------------
 * Dynamic authoritative state — the live condition of the grid, owned solely
 * by the engine. Consumers receive projections of this via events; they never
 * hold or mutate it directly.
 * ---------------------------------------------------------------------------
 */

export interface LineFlow {
  readonly line: LineId;
  readonly flow: MegaWatts;
  /** Flow ÷ capacity; ≥ 1.0 means overloaded. */
  readonly loading: PerUnit;
  readonly state: LineState;
}

export interface ZoneStatus {
  readonly zone: ZoneId;
  readonly state: ZoneState;
  readonly servedLoad: MegaWatts;
  readonly unservedLoad: MegaWatts;
}

export interface GeneratorStatus {
  readonly id: GeneratorId;
  readonly outputMw: MegaWatts;
  readonly capacityMw: MegaWatts;
  readonly tripped: boolean;
}

export interface GridState {
  readonly frequency: Hertz;
  /** Rate of change of frequency, Hz/s. Negative while frequency falls. */
  readonly rocof: number;
  /** Stored kinetic energy of online synchronous machines, MW·s. */
  readonly inertiaMwS: number;
  /** Highest under-frequency load-shedding stage that has fired; 0 = none. */
  readonly uflsStage: number;
  /** Fraction of system load disconnected automatically by UFLS. */
  readonly uflsShedFraction: number;
  /** N-1 contingency verdict for the present operating point. */
  readonly security: SecurityVerdict;
  /** Unloaded capacity on online units, MW. */
  readonly reserveMw: MegaWatts;
  /** Output of the largest single online in-feed, MW. */
  readonly largestInfeedMw: MegaWatts;
  readonly lines: readonly LineFlow[];
  readonly zones: readonly ZoneStatus[];
  readonly totalGeneration: MegaWatts;
  readonly totalLoad: MegaWatts;
  /** Output from Solar + Wind + Storage units this tick. */
  readonly renewableGeneration: MegaWatts;
  readonly generators: readonly GeneratorStatus[];
}
