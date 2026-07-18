import { GenerationKind, asBusId, asGeneratorId, asLineId, asLoadId } from '@app-types';
import { describe, expect, it } from 'vitest';

import { createElectricalGraph } from '../graph';
import { solveDcPowerFlow } from './dc-power-flow';

describe('DC power flow — robustness', () => {
  it('solves a 30-bus radial network with a small residual', () => {
    const n = 30;
    const loadEach = 10;
    const graph = createElectricalGraph({ now: () => 0 });
    graph.mutate((tx) => {
      for (let i = 0; i < n; i += 1) tx.addBus({ id: asBusId(`b${i}`), nominalVoltageKv: 230 });
      for (let i = 0; i < n - 1; i += 1) {
        tx.addLine({
          id: asLineId(`l${i}`),
          from: asBusId(`b${i}`),
          to: asBusId(`b${i + 1}`),
          capacityMw: 1000,
          reactancePu: 0.05,
        });
      }
      tx.addGenerator({
        id: asGeneratorId('g0'),
        busId: asBusId('b0'),
        capacityMw: loadEach * (n - 1),
        generationKind: GenerationKind.Baseload,
      });
      for (let i = 1; i < n; i += 1) {
        tx.addLoad({ id: asLoadId(`ld${i}`), busId: asBusId(`b${i}`), nominalDemandMw: loadEach });
      }
    });
    const result = solveDcPowerFlow(graph);
    expect(result.converged).toBe(true);
    expect(result.maxResidual).toBeLessThan(1e-9);
    expect(Math.abs(result.islands[0]?.powerBalanceMw ?? 1)).toBeLessThan(1e-6);
  });

  it('reports loading above 1 when a line is overloaded', () => {
    const graph = createElectricalGraph({ now: () => 0 });
    graph.mutate((tx) => {
      tx.addBus({ id: asBusId('b1'), nominalVoltageKv: 230 });
      tx.addBus({ id: asBusId('b2'), nominalVoltageKv: 230 });
      tx.addLine({
        id: asLineId('l1'),
        from: asBusId('b1'),
        to: asBusId('b2'),
        capacityMw: 50,
        reactancePu: 0.1,
      });
      tx.addGenerator({
        id: asGeneratorId('g1'),
        busId: asBusId('b1'),
        capacityMw: 100,
        generationKind: GenerationKind.Baseload,
      });
      tx.addLoad({ id: asLoadId('ld1'), busId: asBusId('b2'), nominalDemandMw: 100 });
    });
    const result = solveDcPowerFlow(graph);
    expect(result.maxLoading).toBeCloseTo(2, 6); // 100 MW over a 50 MW line
  });

  it('produces negative flow when power flows against the line orientation', () => {
    const graph = createElectricalGraph({ now: () => 0 });
    graph.mutate((tx) => {
      tx.addBus({ id: asBusId('b1'), nominalVoltageKv: 230 });
      tx.addBus({ id: asBusId('b2'), nominalVoltageKv: 230 });
      // Line oriented b1 → b2, but the generator is at b2 and the load at b1,
      // so real power flows b2 → b1: the b1→b2 flow is negative.
      tx.addLine({
        id: asLineId('l1'),
        from: asBusId('b1'),
        to: asBusId('b2'),
        capacityMw: 100,
        reactancePu: 0.1,
      });
      tx.addGenerator({
        id: asGeneratorId('g2'),
        busId: asBusId('b2'),
        capacityMw: 80,
        generationKind: GenerationKind.Baseload,
      });
      tx.addLoad({ id: asLoadId('ld1'), busId: asBusId('b1'), nominalDemandMw: 80 });
    });
    const result = solveDcPowerFlow(graph);
    expect(result.islands[0]?.slackBus).toBe(asBusId('b2'));
    expect(result.islands[0]?.flows[0]?.flowMw).toBeCloseTo(-80, 6);
  });
});
