import { asBusId, asLineId } from '@app-types';
import { describe, expect, it } from 'vitest';

import { createBus, createTransmissionLine } from '../entities';
import type { GraphEntities } from '../graph-model';
import {
  compareTopology,
  deserializeGraph,
  graphToSnapshot,
  serializeGraph,
  topologyHash,
} from './graph-serializer';

const empty = (): GraphEntities => ({
  buses: [],
  substations: [],
  lines: [],
  transformers: [],
  generators: [],
  loads: [],
  breakers: [],
});

const sample = (tick: number, capacity = 100): GraphEntities => ({
  ...empty(),
  buses: [
    createBus({ id: asBusId('b1'), nominalVoltageKv: 230 }, tick),
    createBus({ id: asBusId('b2'), nominalVoltageKv: 230 }, tick),
  ],
  lines: [
    createTransmissionLine(
      {
        id: asLineId('l1'),
        from: asBusId('b1'),
        to: asBusId('b2'),
        capacityMw: capacity,
        reactancePu: 0.1,
      },
      tick,
    ),
  ],
});

describe('serialization', () => {
  it('round-trips a snapshot losslessly', () => {
    const snapshot = graphToSnapshot(sample(3), 4);
    const text = serializeGraph(snapshot);
    expect(deserializeGraph(text)).toEqual(snapshot);
  });

  it('serializes deterministically regardless of entity order', () => {
    const a = graphToSnapshot(sample(0), 1);
    const reordered: GraphEntities = { ...sample(0), buses: [...sample(0).buses].reverse() };
    const b = graphToSnapshot(reordered, 1);
    expect(serializeGraph(a)).toBe(serializeGraph(b));
  });
});

describe('topologyHash', () => {
  it('is deterministic for identical structure', () => {
    expect(topologyHash(sample(0))).toBe(topologyHash(sample(0)));
  });

  it('ignores provenance (ticks / version)', () => {
    expect(topologyHash(sample(0))).toBe(topologyHash(sample(9)));
  });

  it('changes when structure changes', () => {
    expect(topologyHash(sample(0, 100))).not.toBe(topologyHash(sample(0, 200)));
  });

  it('compareTopology reflects structural equality', () => {
    expect(compareTopology(sample(0, 100), sample(5, 100))).toBe(true);
    expect(compareTopology(sample(0, 100), sample(0, 200))).toBe(false);
  });
});
