import type { BusId, LineId } from '@app-types';

import type { ElectricalGraph } from '../graph';
import { selectSlack } from './slack';
import type { SlackSelection } from './slack';

const DEFAULT_BASE_MVA = 100;

export interface DcBranch {
  readonly line: LineId;
  readonly from: BusId;
  readonly to: BusId;
  /** Series susceptance b = 1 / reactance (per unit). */
  readonly susceptance: number;
  readonly capacityMw: number;
}

/** One island's mathematical model. Each island solves independently. */
export interface DcIsland {
  readonly index: number;
  readonly buses: readonly BusId[];
  readonly busIndex: ReadonlyMap<BusId, number>;
  readonly branches: readonly DcBranch[];
  readonly slack: SlackSelection;
  readonly slackIndex: number;
  readonly generationMw: readonly number[];
  readonly loadMw: readonly number[];
  /** generation − load per bus, MW. */
  readonly netInjectionMw: readonly number[];
  /** n×n bus susceptance matrix B. */
  readonly bMatrix: readonly (readonly number[])[];
}

export interface DcModel {
  readonly baseMva: number;
  readonly islands: readonly DcIsland[];
  readonly busCount: number;
  readonly branchCount: number;
}

export interface DcModelOptions {
  readonly baseMva?: number;
  readonly slackBusId?: BusId;
  /** Generation dispatch per bus (MW). Defaults to summed generator capacity. */
  readonly generationMw?: (bus: BusId) => number;
}

const addTo = (matrix: number[][], row: number, col: number, value: number): void => {
  const target = matrix[row] as number[];
  target[col] = (target[col] as number) + value;
};

/**
 * Pure adapter: convert the (math-free) electrical graph into the mathematical
 * model the DC solver needs — per island: bus index mapping, branch list with
 * susceptances, slack bus, generation/load/net injections, and the bus
 * susceptance matrix. The graph is only READ; no parallel topology is kept.
 *
 * Transformers (Phase-3 placeholders without an impedance model) are excluded
 * from the DC branch set until an impedance model is added.
 */
export function toDcModel(graph: ElectricalGraph, options: DcModelOptions = {}): DcModel {
  const baseMva = options.baseMva ?? DEFAULT_BASE_MVA;

  const genCapacityByBus = new Map<BusId, number>();
  for (const generator of graph.generators()) {
    genCapacityByBus.set(
      generator.busId,
      (genCapacityByBus.get(generator.busId) ?? 0) + generator.capacityMw,
    );
  }
  const loadByBus = new Map<BusId, number>();
  for (const load of graph.loads()) {
    loadByBus.set(load.busId, (loadByBus.get(load.busId) ?? 0) + load.nominalDemandMw);
  }
  const generationOf = (bus: BusId): number =>
    options.generationMw ? options.generationMw(bus) : (genCapacityByBus.get(bus) ?? 0);

  const lines = graph.lines();

  const islands: DcIsland[] = graph.islands().map((islandBuses, index) => {
    const busIndex = new Map<BusId, number>();
    islandBuses.forEach((bus, i) => busIndex.set(bus, i));
    const busSet = new Set(islandBuses);

    const branches: DcBranch[] = lines
      .filter((line) => busSet.has(line.from) && busSet.has(line.to))
      .map((line) => ({
        line: line.id,
        from: line.from,
        to: line.to,
        susceptance: 1 / line.reactancePu,
        capacityMw: line.capacityMw,
      }));

    const n = islandBuses.length;
    const bMatrix: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (const branch of branches) {
      const i = busIndex.get(branch.from) as number;
      const j = busIndex.get(branch.to) as number;
      addTo(bMatrix, i, i, branch.susceptance);
      addTo(bMatrix, j, j, branch.susceptance);
      addTo(bMatrix, i, j, -branch.susceptance);
      addTo(bMatrix, j, i, -branch.susceptance);
    }

    const slack = selectSlack(islandBuses, genCapacityByBus, options.slackBusId);
    return {
      index,
      buses: islandBuses,
      busIndex,
      branches,
      slack,
      slackIndex: busIndex.get(slack.bus) as number,
      generationMw: islandBuses.map(generationOf),
      loadMw: islandBuses.map((bus) => loadByBus.get(bus) ?? 0),
      netInjectionMw: islandBuses.map((bus) => generationOf(bus) - (loadByBus.get(bus) ?? 0)),
      bMatrix,
    };
  });

  return {
    baseMva,
    islands,
    busCount: graph.buses().length,
    branchCount: islands.reduce((sum, island) => sum + island.branches.length, 0),
  };
}
