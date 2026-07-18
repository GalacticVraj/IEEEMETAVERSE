import { GenerationKind, asBusId, asGeneratorId, asLineId } from '@app-types';
import { createEventBus } from '@core';
import { describe, expect, it, vi } from 'vitest';

import { createElectricalGraph } from './electrical-graph';
import { TOPOLOGY_EVENT } from './graph-events';
import type { TopologyEventMap } from './graph-events';

const buildTwoBusGraph = () => {
  const graph = createElectricalGraph({ now: () => 0 });
  graph.mutate((tx) => {
    tx.addBus({ id: asBusId('b1'), nominalVoltageKv: 230 });
    tx.addBus({ id: asBusId('b2'), nominalVoltageKv: 230 });
    tx.addLine({
      id: asLineId('l1'),
      from: asBusId('b1'),
      to: asBusId('b2'),
      capacityMw: 100,
      reactancePu: 0.1,
    });
    tx.addGenerator({
      id: asGeneratorId('g1'),
      busId: asBusId('b1'),
      capacityMw: 200,
      generationKind: GenerationKind.Baseload,
    });
  });
  return graph;
};

describe('ElectricalGraph — construction & queries', () => {
  it('bumps version and exposes entities after a mutation', () => {
    const graph = buildTwoBusGraph();
    expect(graph.version).toBe(1);
    expect(graph.buses()).toHaveLength(2);
    expect(graph.edges()).toHaveLength(1);
    expect(graph.getBus(asBusId('b1'))).toBeDefined();
  });

  it('answers neighbor, source, and path queries', () => {
    const graph = buildTwoBusGraph();
    expect(graph.neighbors(asBusId('b1'))).toEqual([asBusId('b2')]);
    expect(graph.sources()).toEqual([asBusId('b1')]);
    expect(graph.shortestPath(asBusId('b1'), asBusId('b2'))).toEqual([
      asBusId('b1'),
      asBusId('b2'),
    ]);
  });

  it('detects a single island', () => {
    const graph = buildTwoBusGraph();
    expect(graph.islandCount()).toBe(1);
    expect(graph.islands()).toEqual([[asBusId('b1'), asBusId('b2')]]);
    expect(graph.islandOf(asBusId('b2'))).toEqual([asBusId('b1'), asBusId('b2')]);
  });

  it('produces a stable non-empty topology hash', () => {
    const graph = buildTwoBusGraph();
    const first = graph.hash;
    expect(first).not.toBe('');
    expect(graph.hash).toBe(first);
  });
});

describe('ElectricalGraph — mutation pipeline', () => {
  it('rejects an invalid mutation without applying it (fail fast, rollback)', () => {
    const graph = buildTwoBusGraph();
    const versionBefore = graph.version;
    expect(() => {
      graph.mutate((tx) => {
        tx.addLine({
          id: asLineId('bad'),
          from: asBusId('b1'),
          to: asBusId('ghost'),
          capacityMw: 100,
          reactancePu: 0.1,
        });
      });
    }).toThrow();
    expect(graph.version).toBe(versionBefore);
    expect(graph.getLine(asLineId('bad'))).toBeUndefined();
  });

  it('detects a new island when connectivity splits', () => {
    const graph = buildTwoBusGraph();
    graph.mutate((tx) => {
      tx.addBus({ id: asBusId('b3'), nominalVoltageKv: 230 });
      tx.addBus({ id: asBusId('b4'), nominalVoltageKv: 230 });
      tx.addLine({
        id: asLineId('l2'),
        from: asBusId('b3'),
        to: asBusId('b4'),
        capacityMw: 100,
        reactancePu: 0.1,
      });
    });
    expect(graph.islandCount()).toBe(2);
  });

  it('updates entity metadata and bumps its version', () => {
    const graph = buildTwoBusGraph();
    graph.mutate((tx) => {
      tx.updateMetadata('b1', { label: 'north' });
    });
    expect(graph.getBus(asBusId('b1'))?.version).toBe(2);
    expect(graph.getBus(asBusId('b1'))?.metadata['label']).toBe('north');
  });

  it('emits topology events on commit', () => {
    const events = createEventBus<TopologyEventMap>();
    const nodeAdded = vi.fn();
    const edgeAdded = vi.fn();
    const changed = vi.fn();
    events.on(TOPOLOGY_EVENT.NodeAdded, nodeAdded);
    events.on(TOPOLOGY_EVENT.EdgeAdded, edgeAdded);
    events.on(TOPOLOGY_EVENT.TopologyChanged, changed);

    const graph = createElectricalGraph({ now: () => 0, events });
    graph.mutate((tx) => {
      tx.addBus({ id: asBusId('b1'), nominalVoltageKv: 230 });
      tx.addBus({ id: asBusId('b2'), nominalVoltageKv: 230 });
      tx.addLine({
        id: asLineId('l1'),
        from: asBusId('b1'),
        to: asBusId('b2'),
        capacityMw: 100,
        reactancePu: 0.1,
      });
    });
    expect(nodeAdded).toHaveBeenCalledTimes(2);
    expect(edgeAdded).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledTimes(1);
  });
});

describe('ElectricalGraph — serialization & diagnostics', () => {
  it('reports diagnostics', () => {
    const graph = buildTwoBusGraph();
    const diagnostics = graph.diagnostics();
    expect(diagnostics.nodeCount).toBe(2);
    expect(diagnostics.edgeCount).toBe(1);
    expect(diagnostics.islandCount).toBe(1);
    expect(diagnostics.generatorCount).toBe(1);
    expect(diagnostics.validationPassed).toBe(true);
  });

  it('snapshots at the current version', () => {
    const graph = buildTwoBusGraph();
    const snapshot = graph.toSnapshot();
    expect(snapshot.version).toBe(1);
    expect(snapshot.buses).toHaveLength(2);
  });
});
