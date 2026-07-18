import type { BusId, LineId } from '@app-types';

export type ConvergenceStatus = 'converged' | 'singular' | 'invalid' | 'trivial';

/** Immutable per-line flow result (positive = from → to), in MW. */
export interface LineFlowResult {
  readonly line: LineId;
  readonly from: BusId;
  readonly to: BusId;
  readonly flowMw: number;
  /** |flow| ÷ thermal rating (0 when the line has no capacity set). */
  readonly loading: number;
}

/** Immutable per-bus solution. */
export interface BusAngleResult {
  readonly bus: BusId;
  readonly angleRad: number;
  readonly netInjectionMw: number;
}

/** Immutable result for one electrical island. */
export interface IslandResult {
  readonly index: number;
  readonly buses: readonly BusId[];
  readonly slackBus: BusId;
  readonly converged: boolean;
  readonly status: ConvergenceStatus;
  readonly slackGenerationMw: number;
  readonly totalGenerationMw: number;
  readonly totalLoadMw: number;
  /** total generation − total load (≈ 0 for a lossless DC solve). */
  readonly powerBalanceMw: number;
  /** ‖Bθ − P‖∞ over non-slack buses (≈ 0). */
  readonly residual: number;
  readonly angles: readonly BusAngleResult[];
  readonly flows: readonly LineFlowResult[];
}

export interface PowerFlowMetadata {
  readonly baseMva: number;
  readonly islandCount: number;
  readonly busCount: number;
  readonly branchCount: number;
  /** Wall-clock solve time (ms); 0 unless a time provider is injected. */
  readonly executionMs: number;
  /** Topology hash the solution was computed against. */
  readonly topologyHash: string;
}

/** The complete, immutable power-flow solution. The graph is never mutated. */
export interface PowerFlowResult {
  readonly converged: boolean;
  readonly islands: readonly IslandResult[];
  /** All line flows, flattened across islands. */
  readonly flows: readonly LineFlowResult[];
  readonly maxLoading: number;
  readonly maxResidual: number;
  readonly metadata: PowerFlowMetadata;
}
