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

export interface Zone {
  readonly id: ZoneId;
  readonly name: string;
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

export interface GridState {
  readonly frequency: Hertz;
  readonly lines: readonly LineFlow[];
  readonly zones: readonly ZoneStatus[];
  readonly totalGeneration: MegaWatts;
  readonly totalLoad: MegaWatts;
}
