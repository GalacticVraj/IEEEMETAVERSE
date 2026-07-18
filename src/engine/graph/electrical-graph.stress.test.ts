import { asBusId, asLineId } from '@app-types';
import { describe, expect, it } from 'vitest';

import { createElectricalGraph } from './electrical-graph';
import { deserializeGraph, serializeGraph } from './serialization/graph-serializer';

/** Build a chain of `n` buses connected by `n-1` lines in a single transaction. */
const buildChain = (n: number) => {
  const graph = createElectricalGraph({ now: () => 0 });
  graph.mutate((tx) => {
    for (let i = 0; i < n; i += 1) {
      tx.addBus({ id: asBusId(`b${i}`), nominalVoltageKv: 230 });
    }
    for (let i = 0; i < n - 1; i += 1) {
      tx.addLine({
        id: asLineId(`l${i}`),
        from: asBusId(`b${i}`),
        to: asBusId(`b${i + 1}`),
        capacityMw: 100,
        reactancePu: 0.1,
      });
    }
  });
  return graph;
};

describe('ElectricalGraph — large network', () => {
  it('handles a 1000-bus chain as a single validated island', () => {
    const graph = buildChain(1000);
    expect(graph.buses()).toHaveLength(1000);
    expect(graph.edges()).toHaveLength(999);
    expect(graph.islandCount()).toBe(1);
    expect(graph.validate().valid).toBe(true);
  });

  it('produces a deterministic hash across identical builds', () => {
    expect(buildChain(500).hash).toBe(buildChain(500).hash);
  });

  it('round-trips serialization for a large graph', () => {
    const snapshot = buildChain(300).toSnapshot();
    const restored = deserializeGraph(serializeGraph(snapshot));
    expect(restored.buses).toHaveLength(300);
    expect(restored.version).toBe(1);
  });

  it('finds the shortest path across the chain', () => {
    const path = buildChain(50).shortestPath(asBusId('b0'), asBusId('b49'));
    expect(path).not.toBeNull();
    expect(path?.length).toBe(50);
  });
});
