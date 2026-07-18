/* eslint-disable @typescript-eslint/no-magic-numbers -- display formatting precision */
import type { DcIsland } from './dc-model';
import type { PowerFlowResult } from './results';

export interface IslandDiagnostics {
  readonly index: number;
  readonly slackBus: string;
  readonly status: string;
  readonly busCount: number;
  readonly branchCount: number;
  readonly slackGenerationMw: number;
  readonly powerBalanceMw: number;
  readonly residual: number;
}

export interface PowerFlowDiagnostics {
  readonly converged: boolean;
  readonly islandCount: number;
  readonly busCount: number;
  readonly branchCount: number;
  readonly maxLoading: number;
  readonly maxResidual: number;
  readonly executionMs: number;
  readonly islands: readonly IslandDiagnostics[];
}

/** Structured diagnostics for a solve (debug mode / console only). */
export function powerFlowDiagnostics(result: PowerFlowResult): PowerFlowDiagnostics {
  return {
    converged: result.converged,
    islandCount: result.metadata.islandCount,
    busCount: result.metadata.busCount,
    branchCount: result.metadata.branchCount,
    maxLoading: result.maxLoading,
    maxResidual: result.maxResidual,
    executionMs: result.metadata.executionMs,
    islands: result.islands.map((island) => ({
      index: island.index,
      slackBus: String(island.slackBus),
      status: island.status,
      busCount: island.buses.length,
      branchCount: island.flows.length,
      slackGenerationMw: island.slackGenerationMw,
      powerBalanceMw: island.powerBalanceMw,
      residual: island.residual,
    })),
  };
}

/** One-line console summary. */
export function formatPowerFlowDiagnostics(result: PowerFlowResult): string {
  return [
    `powerflow ${result.converged ? 'CONVERGED' : 'FAILED'}`,
    `islands=${result.metadata.islandCount} buses=${result.metadata.busCount} branches=${result.metadata.branchCount}`,
    `maxLoading=${result.maxLoading.toFixed(3)} maxResidual=${result.maxResidual.toExponential(2)}`,
  ].join(' | ');
}

/** A debug line-flow table (MW + loading), one row per line. */
export function lineFlowTable(result: PowerFlowResult): string {
  return result.flows
    .map(
      (flow) =>
        `${String(flow.line)}: ${String(flow.from)}→${String(flow.to)}  ${flow.flowMw.toFixed(2)} MW  (${(flow.loading * 100).toFixed(0)}%)`,
    )
    .join('\n');
}

/** A debug dump of an island's bus susceptance matrix B. */
export function formatBMatrix(island: DcIsland): string {
  return island.bMatrix
    .map((row) => row.map((value) => value.toFixed(3).padStart(8)).join(' '))
    .join('\n');
}
