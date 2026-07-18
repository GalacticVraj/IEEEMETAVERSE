import type {
  Breaker,
  Bus,
  Generator,
  Load,
  Substation,
  Transformer,
  TransmissionLine,
} from './entities/electrical-entities';

/**
 * A flat, id-sorted bag of every entity in the graph. The validator and
 * serializer operate on this (not on the live graph object), which keeps them
 * pure and independently testable.
 */
export interface GraphEntities {
  readonly buses: readonly Bus[];
  readonly substations: readonly Substation[];
  readonly lines: readonly TransmissionLine[];
  readonly transformers: readonly Transformer[];
  readonly generators: readonly Generator[];
  readonly loads: readonly Load[];
  readonly breakers: readonly Breaker[];
}

/** A serializable snapshot of the whole graph (entities + version). */
export interface GraphSnapshot extends GraphEntities {
  readonly version: number;
}

/** Console-facing diagnostics for the graph (no UI). */
export interface GraphDiagnostics {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly islandCount: number;
  readonly generatorCount: number;
  readonly loadCount: number;
  readonly substationCount: number;
  readonly breakerCount: number;
  readonly validationPassed: boolean;
  readonly hash: string;
  readonly version: number;
}
