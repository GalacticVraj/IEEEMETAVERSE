import { GenerationKind, asBusId, asGeneratorId, asLineId } from '@app-types';
import { describe, expect, it } from 'vitest';

import { createBus, createGenerator, createTransmissionLine } from '../entities';
import type { GraphEntities } from '../graph-model';
import { validateGraph } from './validator';

const T = 0;

const entities = (over: Partial<GraphEntities>): GraphEntities => ({
  buses: [],
  substations: [],
  lines: [],
  transformers: [],
  generators: [],
  loads: [],
  breakers: [],
  ...over,
});

const bus = (id: string) => createBus({ id: asBusId(id), nominalVoltageKv: 230 }, T);
const line = (
  id: string,
  from: string,
  to: string,
  extra?: { capacityMw?: number; reactancePu?: number },
) =>
  createTransmissionLine(
    {
      id: asLineId(id),
      from: asBusId(from),
      to: asBusId(to),
      capacityMw: extra?.capacityMw ?? 100,
      reactancePu: extra?.reactancePu ?? 0.1,
    },
    T,
  );

describe('validateGraph', () => {
  it('accepts a well-formed graph', () => {
    const report = validateGraph(
      entities({
        buses: [bus('b1'), bus('b2')],
        lines: [line('l1', 'b1', 'b2')],
        generators: [
          createGenerator(
            {
              id: asGeneratorId('g1'),
              busId: asBusId('b1'),
              capacityMw: 200,
              generationKind: GenerationKind.Baseload,
            },
            T,
          ),
        ],
      }),
    );
    expect(report.valid).toBe(true);
    expect(report.errorCount).toBe(0);
  });

  it('rejects a line referencing a missing bus', () => {
    const report = validateGraph(
      entities({ buses: [bus('b1')], lines: [line('l1', 'b1', 'ghost')] }),
    );
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'MISSING_REFERENCE')).toBe(true);
  });

  it('rejects a self-loop edge', () => {
    const report = validateGraph(entities({ buses: [bus('b1')], lines: [line('l1', 'b1', 'b1')] }));
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'SELF_LOOP')).toBe(true);
  });

  it('rejects a negative capacity', () => {
    const report = validateGraph(
      entities({
        buses: [bus('b1'), bus('b2')],
        lines: [line('l1', 'b1', 'b2', { capacityMw: -5 })],
      }),
    );
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'NEGATIVE_CAPACITY')).toBe(true);
  });

  it('warns on zero reactance but stays valid', () => {
    const report = validateGraph(
      entities({
        buses: [bus('b1'), bus('b2')],
        lines: [line('l1', 'b1', 'b2', { reactancePu: 0 })],
      }),
    );
    expect(report.valid).toBe(true);
    expect(report.issues.some((i) => i.code === 'ZERO_REACTANCE' && i.severity === 'warning')).toBe(
      true,
    );
  });

  it('rejects duplicate ids', () => {
    const report = validateGraph(entities({ buses: [bus('b1'), bus('b1')] }));
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'DUPLICATE_ID')).toBe(true);
  });

  it('rejects a generator on a missing bus', () => {
    const report = validateGraph(
      entities({
        buses: [bus('b1')],
        generators: [
          createGenerator(
            {
              id: asGeneratorId('g1'),
              busId: asBusId('ghost'),
              capacityMw: 10,
              generationKind: GenerationKind.Solar,
            },
            T,
          ),
        ],
      }),
    );
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'MISSING_REFERENCE')).toBe(true);
  });

  it('warns on a disconnected bus', () => {
    const report = validateGraph(entities({ buses: [bus('b1'), bus('b2')], lines: [] }));
    expect(report.valid).toBe(true);
    expect(report.issues.some((i) => i.code === 'DISCONNECTED_BUS')).toBe(true);
  });
});
