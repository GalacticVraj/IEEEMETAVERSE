import { GenerationKind, asBusId, asGeneratorId, asLineId, asLoadId } from '@app-types';
import { createEventBus } from '@core';
import { describe, expect, it, vi } from 'vitest';

import { createElectricalGraph } from '../graph';
import type { ElectricalGraph } from '../graph';
import { solveDcPowerFlow } from './dc-power-flow';
import { powerFlowDiagnostics } from './diagnostics';
import { POWER_FLOW_EVENT } from './powerflow-events';
import type { PowerFlowEventMap } from './powerflow-events';
import { validatePowerFlowResult, validateSolvable } from './validation';

const line = (id: string, from: string, to: string, reactancePu = 0.1, capacityMw = 100) => ({
  id: asLineId(id),
  from: asBusId(from),
  to: asBusId(to),
  capacityMw,
  reactancePu,
});

const twoBus = (reactancePu = 0.1): ElectricalGraph => {
  const graph = createElectricalGraph({ now: () => 0 });
  graph.mutate((tx) => {
    tx.addBus({ id: asBusId('b1'), nominalVoltageKv: 230 });
    tx.addBus({ id: asBusId('b2'), nominalVoltageKv: 230 });
    tx.addLine(line('l1', 'b1', 'b2', reactancePu));
    tx.addGenerator({
      id: asGeneratorId('g1'),
      busId: asBusId('b1'),
      capacityMw: 100,
      generationKind: GenerationKind.Baseload,
    });
    tx.addLoad({ id: asLoadId('ld1'), busId: asBusId('b2'), nominalDemandMw: 100 });
  });
  return graph;
};

describe('DC power flow — two-bus', () => {
  it('solves flow, slack, and balance', () => {
    const result = solveDcPowerFlow(twoBus());
    expect(result.converged).toBe(true);
    expect(result.islands).toHaveLength(1);

    const island = result.islands[0];
    expect(island?.slackBus).toBe(asBusId('b1'));
    expect(island?.flows[0]?.flowMw).toBeCloseTo(100, 6);
    expect(island?.flows[0]?.loading).toBeCloseTo(1, 6);
    expect(island?.slackGenerationMw).toBeCloseTo(100, 6);
    expect(Math.abs(island?.powerBalanceMw ?? 1)).toBeLessThan(1e-6);
    expect(island?.residual ?? 1).toBeLessThan(1e-9);
  });

  it('passes post-solve validation', () => {
    expect(validatePowerFlowResult(solveDcPowerFlow(twoBus())).valid).toBe(true);
  });

  it('never mutates the graph', () => {
    const graph = twoBus();
    const versionBefore = graph.version;
    const hashBefore = graph.hash;
    solveDcPowerFlow(graph);
    expect(graph.version).toBe(versionBefore);
    expect(graph.hash).toBe(hashBefore);
  });
});

describe('DC power flow — three-bus', () => {
  it('solves a balanced three-bus network', () => {
    const graph = createElectricalGraph({ now: () => 0 });
    graph.mutate((tx) => {
      for (const id of ['b1', 'b2', 'b3']) tx.addBus({ id: asBusId(id), nominalVoltageKv: 230 });
      tx.addLine(line('l1', 'b1', 'b2'));
      tx.addLine(line('l2', 'b1', 'b3'));
      tx.addLine(line('l3', 'b2', 'b3'));
      tx.addGenerator({
        id: asGeneratorId('g1'),
        busId: asBusId('b1'),
        capacityMw: 100,
        generationKind: GenerationKind.Baseload,
      });
      tx.addLoad({ id: asLoadId('ld2'), busId: asBusId('b2'), nominalDemandMw: 60 });
      tx.addLoad({ id: asLoadId('ld3'), busId: asBusId('b3'), nominalDemandMw: 40 });
    });
    const result = solveDcPowerFlow(graph);
    expect(result.converged).toBe(true);
    const island = result.islands[0];
    expect(island?.totalLoadMw).toBeCloseTo(100, 6);
    expect(Math.abs(island?.powerBalanceMw ?? 1)).toBeLessThan(1e-6);
    expect(result.maxResidual).toBeLessThan(1e-9);
  });
});

describe('DC power flow — islands & edge cases', () => {
  it('solves multiple islands independently', () => {
    const graph = createElectricalGraph({ now: () => 0 });
    graph.mutate((tx) => {
      for (const id of ['a1', 'a2', 'c1', 'c2'])
        tx.addBus({ id: asBusId(id), nominalVoltageKv: 230 });
      tx.addLine(line('la', 'a1', 'a2'));
      tx.addLine(line('lc', 'c1', 'c2'));
      tx.addGenerator({
        id: asGeneratorId('ga'),
        busId: asBusId('a1'),
        capacityMw: 50,
        generationKind: GenerationKind.Baseload,
      });
      tx.addLoad({ id: asLoadId('lda'), busId: asBusId('a2'), nominalDemandMw: 50 });
      tx.addGenerator({
        id: asGeneratorId('gc'),
        busId: asBusId('c1'),
        capacityMw: 30,
        generationKind: GenerationKind.Baseload,
      });
      tx.addLoad({ id: asLoadId('ldc'), busId: asBusId('c2'), nominalDemandMw: 30 });
    });
    const result = solveDcPowerFlow(graph);
    expect(result.islands).toHaveLength(2);
    expect(result.converged).toBe(true);
  });

  it('handles an island with no generator (slack supplies the load)', () => {
    const graph = createElectricalGraph({ now: () => 0 });
    graph.mutate((tx) => {
      tx.addBus({ id: asBusId('b1'), nominalVoltageKv: 230 });
      tx.addBus({ id: asBusId('b2'), nominalVoltageKv: 230 });
      tx.addLine(line('l1', 'b1', 'b2'));
      tx.addLoad({ id: asLoadId('ld1'), busId: asBusId('b2'), nominalDemandMw: 40 });
    });
    const result = solveDcPowerFlow(graph);
    const island = result.islands[0];
    expect(island?.slackBus).toBe(asBusId('b1'));
    expect(island?.slackGenerationMw).toBeCloseTo(40, 6);
    expect(result.converged).toBe(true);
  });

  it('rejects invalid reactance', () => {
    const graph = twoBus(0); // zero reactance (graph warns, solver rejects)
    expect(validateSolvable(graph).valid).toBe(false);
    const result = solveDcPowerFlow(graph);
    expect(result.converged).toBe(false);
    expect(result.islands[0]?.status).toBe('invalid');
  });

  it('is deterministic', () => {
    expect(solveDcPowerFlow(twoBus())).toEqual(solveDcPowerFlow(twoBus()));
  });
});

describe('DC power flow — events & diagnostics', () => {
  it('emits the solve event sequence', () => {
    const events = createEventBus<PowerFlowEventMap>();
    const started = vi.fn();
    const slack = vi.fn();
    const islandSolved = vi.fn();
    const solved = vi.fn();
    const balance = vi.fn();
    events.on(POWER_FLOW_EVENT.PowerFlowStarted, started);
    events.on(POWER_FLOW_EVENT.SlackBusSelected, slack);
    events.on(POWER_FLOW_EVENT.IslandSolved, islandSolved);
    events.on(POWER_FLOW_EVENT.PowerFlowSolved, solved);
    events.on(POWER_FLOW_EVENT.PowerBalanceComputed, balance);
    solveDcPowerFlow(twoBus(), { events });
    expect(started).toHaveBeenCalledTimes(1);
    expect(slack).toHaveBeenCalledTimes(1);
    expect(islandSolved).toHaveBeenCalledTimes(1);
    expect(solved).toHaveBeenCalledTimes(1);
    expect(balance).toHaveBeenCalledTimes(1);
  });

  it('reports diagnostics', () => {
    const diagnostics = powerFlowDiagnostics(solveDcPowerFlow(twoBus()));
    expect(diagnostics.converged).toBe(true);
    expect(diagnostics.islandCount).toBe(1);
    expect(diagnostics.busCount).toBe(2);
    expect(diagnostics.islands[0]?.slackGenerationMw).toBeCloseTo(100, 6);
  });
});
