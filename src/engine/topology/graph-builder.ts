import type { BusId } from '@app-types';

import type { ElectricalGraph, MutationResult } from '../graph/electrical-graph';
import type { GridTopology } from '../model/grid';

/**
 * Populates an ElectricalGraph from a static GridTopology in ONE transaction:
 * buses first, then lines, generators, loads. Bus metadata carries the zone so
 * downstream consumers can group without re-reading the topology.
 *
 * Note: topology `NodeId` and graph `BusId` are distinct brands over the same
 * string values — the casts below are the single sanctioned bridge point.
 */
export function populateGraphFromTopology(
  graph: ElectricalGraph,
  topology: GridTopology,
): MutationResult {
  return graph.mutate((tx) => {
    for (const node of topology.nodes) {
      tx.addBus({
        id: node.id as unknown as BusId,
        nominalVoltageKv: 230,
        metadata: { zone: node.zone },
      });
    }
    for (const line of topology.lines) {
      tx.addLine({
        id: line.id,
        from: line.from as unknown as BusId,
        to: line.to as unknown as BusId,
        capacityMw: line.capacity,
        reactancePu: line.reactance,
      });
    }
    for (const generator of topology.generators) {
      tx.addGenerator({
        id: generator.id,
        busId: generator.node as unknown as BusId,
        capacityMw: generator.capacity,
        generationKind: generator.kind,
      });
    }
    for (const load of topology.loads) {
      tx.addLoad({
        id: load.id,
        busId: load.node as unknown as BusId,
        nominalDemandMw: load.nominalDemand,
        critical: load.critical,
        metadata: { zone: load.zone },
      });
    }
  });
}
