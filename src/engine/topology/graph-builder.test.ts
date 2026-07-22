import { describe, expect, it } from 'vitest';

import { createElectricalGraph } from '../graph/electrical-graph';

import { populateGraphFromTopology } from './graph-builder';
import { MERIDIAN_BAY_TOPOLOGY } from './meridian-bay';

describe('populateGraphFromTopology', () => {
  it('populates a fresh graph with the full Meridian Bay topology in one transaction', () => {
    const graph = createElectricalGraph({});

    const result = populateGraphFromTopology(graph, MERIDIAN_BAY_TOPOLOGY);

    expect(graph.buses()).toHaveLength(20);
    expect(graph.lines()).toHaveLength(30);
    expect(graph.generators()).toHaveLength(8);
    expect(graph.loads()).toHaveLength(18);
    expect(result.version).toBe(1);
  });

  it('produces a valid, fully connected single-island grid', () => {
    const graph = createElectricalGraph({});

    populateGraphFromTopology(graph, MERIDIAN_BAY_TOPOLOGY);

    expect(graph.validate().errorCount).toBe(0);
    expect(graph.islandCount()).toBe(1);
  });

  it('carries zone metadata on every bus', () => {
    const graph = createElectricalGraph({});

    populateGraphFromTopology(graph, MERIDIAN_BAY_TOPOLOGY);

    for (const node of MERIDIAN_BAY_TOPOLOGY.nodes) {
      const bus = graph.buses().find((b) => (b.id as string) === (node.id as string));
      expect(bus).toBeDefined();
      expect(bus?.metadata['zone']).toBe(node.zone);
      expect(bus?.nominalVoltageKv).toBe(230);
    }
  });
});
