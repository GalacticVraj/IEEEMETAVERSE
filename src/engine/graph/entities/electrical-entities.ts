import type {
  BreakerId,
  BusId,
  GenerationKind,
  GeneratorId,
  LineId,
  LoadId,
  SubstationId,
  TransformerId,
} from '@app-types';

import { EntityKind, initialMeta } from './entity';
import type { EntityMeta } from './entity';

type Metadata = Readonly<Record<string, unknown>>;

/** Breaker position. Modeled as data; no protection/tripping logic in Phase 3. */
export const BreakerState = {
  Open: 'open',
  Closed: 'closed',
} as const;
export type BreakerState = (typeof BreakerState)[keyof typeof BreakerState];

// --- Bus (graph node) -------------------------------------------------------

export interface Bus extends EntityMeta {
  readonly id: BusId;
  readonly kind: 'bus';
  readonly nominalVoltageKv: number;
  readonly substationId: SubstationId | null;
}
export interface BusSpec {
  readonly id: BusId;
  readonly nominalVoltageKv: number;
  readonly substationId?: SubstationId | null;
  readonly metadata?: Metadata;
}
export const createBus = (spec: BusSpec, tick: number): Bus => ({
  id: spec.id,
  kind: EntityKind.Bus,
  nominalVoltageKv: spec.nominalVoltageKv,
  substationId: spec.substationId ?? null,
  ...initialMeta(tick, spec.metadata),
});

// --- Substation (bus grouping) ----------------------------------------------

export interface Substation extends EntityMeta {
  readonly id: SubstationId;
  readonly kind: 'substation';
  readonly name: string;
  readonly busIds: readonly BusId[];
}
export interface SubstationSpec {
  readonly id: SubstationId;
  readonly name: string;
  readonly busIds?: readonly BusId[];
  readonly metadata?: Metadata;
}
export const createSubstation = (spec: SubstationSpec, tick: number): Substation => ({
  id: spec.id,
  kind: EntityKind.Substation,
  name: spec.name,
  busIds: spec.busIds ?? [],
  ...initialMeta(tick, spec.metadata),
});

// --- Transmission line (graph edge) -----------------------------------------

export interface TransmissionLine extends EntityMeta {
  readonly id: LineId;
  readonly kind: 'line';
  readonly from: BusId;
  readonly to: BusId;
  readonly capacityMw: number;
  readonly reactancePu: number;
  readonly breakerIds: readonly BreakerId[];
}
export interface TransmissionLineSpec {
  readonly id: LineId;
  readonly from: BusId;
  readonly to: BusId;
  readonly capacityMw: number;
  readonly reactancePu: number;
  readonly breakerIds?: readonly BreakerId[];
  readonly metadata?: Metadata;
}
export const createTransmissionLine = (
  spec: TransmissionLineSpec,
  tick: number,
): TransmissionLine => ({
  id: spec.id,
  kind: EntityKind.Line,
  from: spec.from,
  to: spec.to,
  capacityMw: spec.capacityMw,
  reactancePu: spec.reactancePu,
  breakerIds: spec.breakerIds ?? [],
  ...initialMeta(tick, spec.metadata),
});

// --- Transformer (placeholder edge) -----------------------------------------

export interface Transformer extends EntityMeta {
  readonly id: TransformerId;
  readonly kind: 'transformer';
  readonly from: BusId;
  readonly to: BusId;
  /** Turns ratio (placeholder — no impedance model yet). */
  readonly turnsRatio: number;
}
export interface TransformerSpec {
  readonly id: TransformerId;
  readonly from: BusId;
  readonly to: BusId;
  readonly turnsRatio: number;
  readonly metadata?: Metadata;
}
export const createTransformer = (spec: TransformerSpec, tick: number): Transformer => ({
  id: spec.id,
  kind: EntityKind.Transformer,
  from: spec.from,
  to: spec.to,
  turnsRatio: spec.turnsRatio,
  ...initialMeta(tick, spec.metadata),
});

// --- Generator (bus attachment) ---------------------------------------------

export interface Generator extends EntityMeta {
  readonly id: GeneratorId;
  readonly kind: 'generator';
  readonly busId: BusId;
  readonly capacityMw: number;
  readonly generationKind: GenerationKind;
}
export interface GeneratorSpec {
  readonly id: GeneratorId;
  readonly busId: BusId;
  readonly capacityMw: number;
  readonly generationKind: GenerationKind;
  readonly metadata?: Metadata;
}
export const createGenerator = (spec: GeneratorSpec, tick: number): Generator => ({
  id: spec.id,
  kind: EntityKind.Generator,
  busId: spec.busId,
  capacityMw: spec.capacityMw,
  generationKind: spec.generationKind,
  ...initialMeta(tick, spec.metadata),
});

// --- Load (bus attachment) --------------------------------------------------

export interface Load extends EntityMeta {
  readonly id: LoadId;
  readonly kind: 'load';
  readonly busId: BusId;
  readonly nominalDemandMw: number;
  readonly critical: boolean;
}
export interface LoadSpec {
  readonly id: LoadId;
  readonly busId: BusId;
  readonly nominalDemandMw: number;
  readonly critical?: boolean;
  readonly metadata?: Metadata;
}
export const createLoad = (spec: LoadSpec, tick: number): Load => ({
  id: spec.id,
  kind: EntityKind.Load,
  busId: spec.busId,
  nominalDemandMw: spec.nominalDemandMw,
  critical: spec.critical ?? false,
  ...initialMeta(tick, spec.metadata),
});

// --- Breaker (line/bus attachment) ------------------------------------------

export interface Breaker extends EntityMeta {
  readonly id: BreakerId;
  readonly kind: 'breaker';
  readonly lineId: LineId | null;
  readonly busId: BusId | null;
  readonly state: BreakerState;
  readonly normallyClosed: boolean;
}
export interface BreakerSpec {
  readonly id: BreakerId;
  readonly lineId?: LineId | null;
  readonly busId?: BusId | null;
  readonly state?: BreakerState;
  readonly normallyClosed?: boolean;
  readonly metadata?: Metadata;
}
export const createBreaker = (spec: BreakerSpec, tick: number): Breaker => ({
  id: spec.id,
  kind: EntityKind.Breaker,
  lineId: spec.lineId ?? null,
  busId: spec.busId ?? null,
  state: spec.state ?? BreakerState.Closed,
  normallyClosed: spec.normallyClosed ?? true,
  ...initialMeta(tick, spec.metadata),
});

/** Any electrical entity. */
export type ElectricalEntity =
  Bus | Substation | TransmissionLine | Transformer | Generator | Load | Breaker;

/** A graph edge connects two buses (line or transformer). */
export type GraphEdge = TransmissionLine | Transformer;
