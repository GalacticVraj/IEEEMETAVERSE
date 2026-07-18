import type { TypedEventBus } from '@core';

import type { ElectricalGraph } from '../graph';
import { toDcModel } from './dc-model';
import type { DcIsland, DcModelOptions } from './dc-model';
import { solveLinearSystem } from './linear-solver';
import { POWER_FLOW_EVENT } from './powerflow-events';
import type { PowerFlowEventMap } from './powerflow-events';
import type {
  BusAngleResult,
  ConvergenceStatus,
  IslandResult,
  LineFlowResult,
  PowerFlowResult,
} from './results';
import { validateSolvable } from './validation';

export interface DcPowerFlowOptions extends DcModelOptions {
  /** Optional bus to emit power-flow events on. */
  readonly events?: TypedEventBus<PowerFlowEventMap>;
  /** Injected wall-clock (ms) for `executionMs`. Defaults to 0 (deterministic). */
  readonly timeProvider?: () => number;
}

const atB = (matrix: readonly (readonly number[])[], row: number, col: number): number =>
  (matrix[row] as readonly number[])[col] as number;

const makeInvalidIsland = (island: DcIsland): IslandResult => ({
  index: island.index,
  buses: island.buses,
  slackBus: island.slack.bus,
  converged: false,
  status: 'invalid',
  slackGenerationMw: 0,
  totalGenerationMw: 0,
  totalLoadMw: island.loadMw.reduce((sum, value) => sum + value, 0),
  powerBalanceMw: 0,
  residual: 0,
  angles: island.buses.map((bus) => ({ bus, angleRad: 0, netInjectionMw: 0 })),
  flows: [],
});

function solveIsland(island: DcIsland, baseMva: number): IslandResult {
  const n = island.buses.length;
  const slackIndex = island.slackIndex;
  const nonSlack: number[] = [];
  for (let i = 0; i < n; i += 1) {
    if (i !== slackIndex) nonSlack.push(i);
  }

  const angles = new Array<number>(n).fill(0); // radians; slack angle = 0
  let status: ConvergenceStatus = 'converged';
  let converged = true;

  if (n === 1) {
    status = 'trivial';
  } else {
    const bReduced = nonSlack.map((row) => nonSlack.map((col) => atB(island.bMatrix, row, col)));
    const pReduced = nonSlack.map((row) => (island.netInjectionMw[row] as number) / baseMva);
    const solution = solveLinearSystem(bReduced, pReduced);
    if (!solution.ok) {
      status = 'singular';
      converged = false;
    } else {
      nonSlack.forEach((index, k) => {
        angles[index] = solution.x[k] as number;
      });
    }
  }

  const computedInjectionMw = (index: number): number => {
    let sum = 0;
    for (let j = 0; j < n; j += 1) {
      sum += atB(island.bMatrix, index, j) * (angles[j] as number);
    }
    return sum * baseMva;
  };

  const flows: LineFlowResult[] = island.branches.map((branch) => {
    const from = island.busIndex.get(branch.from) as number;
    const to = island.busIndex.get(branch.to) as number;
    const flowMw = converged
      ? branch.susceptance * ((angles[from] as number) - (angles[to] as number)) * baseMva
      : 0;
    const loading = branch.capacityMw > 0 ? Math.abs(flowMw) / branch.capacityMw : 0;
    return { line: branch.line, from: branch.from, to: branch.to, flowMw, loading };
  });

  const slackNetMw = converged ? computedInjectionMw(slackIndex) : 0;
  const slackGenerationMw = slackNetMw + (island.loadMw[slackIndex] as number);
  const nonSlackGenerationMw = nonSlack.reduce(
    (sum, index) => sum + (island.generationMw[index] as number),
    0,
  );
  const totalGenerationMw = slackGenerationMw + nonSlackGenerationMw;
  const totalLoadMw = island.loadMw.reduce((sum, value) => sum + value, 0);

  let residual = 0;
  if (converged) {
    for (const index of nonSlack) {
      const diff = Math.abs(computedInjectionMw(index) - (island.netInjectionMw[index] as number));
      if (diff > residual) residual = diff;
    }
  }

  const angleResults: BusAngleResult[] = island.buses.map((bus, index) => ({
    bus,
    angleRad: angles[index] as number,
    netInjectionMw: index === slackIndex ? slackNetMw : (island.netInjectionMw[index] as number),
  }));

  return {
    index: island.index,
    buses: island.buses,
    slackBus: island.slack.bus,
    converged,
    status,
    slackGenerationMw,
    totalGenerationMw,
    totalLoadMw,
    powerBalanceMw: totalGenerationMw - totalLoadMw,
    residual,
    angles: angleResults,
    flows,
  };
}

/**
 * Deterministic DC power flow over the current graph topology. Reads the graph
 * only (never mutates it), solves each island independently (Bθ = P with the
 * slack angle fixed at 0), and returns immutable results. Identical inputs
 * always produce identical outputs.
 */
export function solveDcPowerFlow(
  graph: ElectricalGraph,
  options: DcPowerFlowOptions = {},
): PowerFlowResult {
  const now = options.timeProvider ?? ((): number => 0);
  const eventBus = options.events;
  const emit = (name: string, payload: unknown): void => {
    if (eventBus !== undefined) {
      (eventBus as unknown as { emit(n: string, p: unknown): void }).emit(name, payload);
    }
  };

  const startedMs = now();
  const topologyHash = graph.hash;
  const solvable = validateSolvable(graph);
  const model = toDcModel(graph, options);

  emit(POWER_FLOW_EVENT.PowerFlowStarted, {
    topologyHash,
    islandCount: model.islands.length,
  });

  const islandResults: IslandResult[] = [];
  if (!solvable.valid) {
    for (const island of model.islands) {
      islandResults.push(makeInvalidIsland(island));
    }
    emit(POWER_FLOW_EVENT.SolverFailed, { island: null, reason: 'invalid reactance' });
  } else {
    for (const island of model.islands) {
      emit(POWER_FLOW_EVENT.SlackBusSelected, {
        island: island.index,
        bus: island.slack.bus,
        reason: island.slack.reason,
      });
      const result = solveIsland(island, model.baseMva);
      islandResults.push(result);
      emit(POWER_FLOW_EVENT.IslandSolved, {
        island: island.index,
        converged: result.converged,
        slackGenerationMw: result.slackGenerationMw,
        residual: result.residual,
      });
      if (!result.converged) {
        emit(POWER_FLOW_EVENT.SolverFailed, { island: island.index, reason: result.status });
      }
    }
  }

  const flows = islandResults.flatMap((result) => result.flows);
  const converged = solvable.valid && islandResults.every((result) => result.converged);
  const maxLoading = flows.reduce((max, flow) => Math.max(max, flow.loading), 0);
  const maxResidual = islandResults.reduce((max, result) => Math.max(max, result.residual), 0);
  const totalGenerationMw = islandResults.reduce(
    (sum, result) => sum + result.totalGenerationMw,
    0,
  );
  const totalLoadMw = islandResults.reduce((sum, result) => sum + result.totalLoadMw, 0);

  emit(POWER_FLOW_EVENT.PowerBalanceComputed, {
    totalGenerationMw,
    totalLoadMw,
    balanceMw: totalGenerationMw - totalLoadMw,
  });

  const executionMs = now() - startedMs;
  if (converged) {
    emit(POWER_FLOW_EVENT.PowerFlowSolved, { converged, maxLoading, maxResidual, executionMs });
  }

  return {
    converged,
    islands: islandResults,
    flows,
    maxLoading,
    maxResidual,
    metadata: {
      baseMva: model.baseMva,
      islandCount: model.islands.length,
      busCount: model.busCount,
      branchCount: model.branchCount,
      executionMs,
      topologyHash,
    },
  };
}
