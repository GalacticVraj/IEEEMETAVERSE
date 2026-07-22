import { asBusId, asGeneratorId, asLineId, asMegaWatts } from '@app-types';
import { GRID_EVENT } from '@constants';
import { createEventBus } from '@core';
import { describe, expect, it, vi } from 'vitest';

import { createElectricalGraph } from '../graph';
import type { GridState, GridTopology } from '../model/grid';
import { createProtectionEngine } from '../protection/protection-engine';
import { DeterministicRestorationController } from './restoration';

describe('DeterministicRestorationController', () => {
  const makeMockContext = () => {
    const events = createEventBus<any>();
    const emitSpy = vi.spyOn(events, 'emit');
    return {
      events,
      rng: {} as any,
      clock: { tick: 5 } as any,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        child: () => (this as any).logger,
      } as any,
      emitSpy,
    };
  };

  const makeMockTopologyService = () => {
    return {
      get: () =>
        ({
          nodes: [{ id: asBusId('b1'), zone: 'DT' as any }, { id: asBusId('b2'), zone: 'DT' as any }],
          lines: [
            { id: asLineId('l1'), from: asBusId('b1'), to: asBusId('b2'), capacity: asMegaWatts(100), reactance: 0.1 as any },
          ],
          generators: [
            { id: asGeneratorId('G-GAS-HB'), node: asBusId('b1'), kind: 'Peaker' as any, capacity: asMegaWatts(60) },
          ],
          loads: [],
          zones: [{ id: 'DT' as any, name: 'Downtown', buildingIds: [] }],
        }) as unknown as GridTopology,
    };
  };

  it('recloses a line when it cools down', () => {
    const topoService = makeMockTopologyService();
    const graph = createElectricalGraph({ now: () => 0 });

    // Line initially in graph
    graph.mutate((tx) => {
      tx.addBus({ id: asBusId('b1'), nominalVoltageKv: 230 });
      tx.addBus({ id: asBusId('b2'), nominalVoltageKv: 230 });
      tx.addLine({ id: asLineId('l1'), from: asBusId('b1'), to: asBusId('b2'), capacityMw: 100, reactancePu: 0.1 });
    });

    const protection = createProtectionEngine();
    protection.register(graph);

    const generationModel = {
      isTripped: vi.fn().mockReturnValue(false),
      untripGenerator: vi.fn(),
    } as any;

    const controller = new DeterministicRestorationController(
      topoService,
      graph,
      protection,
      generationModel,
    );

    const ctx = makeMockContext();
    controller.init(ctx);

    // 1. Simulate tripping the line (breaker takes 1 tick to open, so evaluate twice)
    protection.evaluate({ graph, flows: [{ line: asLineId('l1'), loading: 2.0 }], tick: 1, timestepS: 1 });
    protection.evaluate({ graph, flows: [{ line: asLineId('l1'), loading: 0.0 }], tick: 2, timestepS: 1 });

    // Line should be removed from graph now
    expect(graph.getLine(asLineId('l1'))).toBeUndefined();
    expect(protection.breakerFor(asLineId('l1'))?.phase).toBe('Open');


    // Make it cool down (below warningC=75C)
    const thermal = protection.thermalFor(asLineId('l1'));
    if (thermal) {
      // Mutate thermal state directly for testing
      (thermal as any).temperatureC = 50;
    }

    const state: GridState = {
      frequency: 60 as any,
      lines: [],
      zones: [{ zone: 'DT' as any, state: 'Powered', servedLoad: 0 as any, unservedLoad: 0 as any }],
      totalGeneration: 100 as any,
      totalLoad: 100 as any,
      renewableGeneration: 0 as any,
      generators: [],
    };

    controller.plan(state);

    // Breaker should transition to Closing
    expect(protection.breakerFor(asLineId('l1'))?.phase).toBe('Closing');
    expect(ctx.emitSpy).toHaveBeenCalledWith(GRID_EVENT.LineRecovered, { line: asLineId('l1') });
  });

  it('untrips G-GAS-HB under blackout conditions', () => {
    const topoService = makeMockTopologyService();
    const graph = createElectricalGraph({ now: () => 0 });
    const protection = createProtectionEngine();
    const generationModel = {
      isTripped: vi.fn().mockReturnValue(true),
      untripGenerator: vi.fn(),
    } as any;

    const controller = new DeterministicRestorationController(
      topoService,
      graph,
      protection,
      generationModel,
    );

    const ctx = makeMockContext();
    controller.init(ctx);

    const state: GridState = {
      frequency: 60 as any,
      lines: [],
      zones: [{ zone: 'DT' as any, state: 'Blackout', servedLoad: 0 as any, unservedLoad: 100 as any }],
      totalGeneration: 0 as any,
      totalLoad: 100 as any,
      renewableGeneration: 0 as any,
      generators: [],
    };

    controller.plan(state);

    expect(generationModel.untripGenerator).toHaveBeenCalledWith(asGeneratorId('G-GAS-HB'));
  });
});
