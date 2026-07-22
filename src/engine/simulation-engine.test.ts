import { asCelsius, asGeneratorId, asLineId, asMegaWatts, asRatio, asSystemId } from '@app-types';
import { GRID_EVENT } from '@constants';
import { createEventBus } from '@core';
import { describe, expect, it, vi } from 'vitest';

import { createElectricalGraph } from './graph';
import { GridSimulationEngine } from './simulation-engine';

describe('GridSimulationEngine', () => {
  const makeMockContext = () => {
    const events = createEventBus<any>();
    const emitSpy = vi.spyOn(events, 'emit');
    return {
      events,
      rng: {} as any,
      clock: { tick: 1 } as any,
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

  const makeMockTopologyService = () => ({
    get: () => ({
      nodes: [
        { id: 'b1' as any, zone: 'Z1' as any },
        { id: 'b2' as any, zone: 'Z1' as any },
      ],
      lines: [
        { id: asLineId('l1'), from: 'b1' as any, to: 'b2' as any, capacity: asMegaWatts(100), reactance: 0.1 as any },
      ],
      generators: [
        { id: asGeneratorId('g1'), node: 'b1' as any, kind: 'Baseload' as any, capacity: asMegaWatts(100) },
      ],
      loads: [
        { id: 'ld1' as any, node: 'b2' as any, zone: 'Z1' as any, nominalDemand: asMegaWatts(50), critical: false },
      ],
      zones: [{ id: 'Z1' as any, name: 'Zone 1', buildingIds: [] }],
    }),
  });

  const setupMockEngine = (graph: any) => {
    const topo = makeMockTopologyService();
    const weather = {
      id: asSystemId('weather'),
      init: vi.fn(),
      step: vi.fn(),
      reset: vi.fn(),
      dispose: vi.fn(),
      advance: vi.fn().mockReturnValue({ temperature: asCelsius(25), irradiance: asRatio(1.0), wind: asRatio(0.5) }),
      current: vi.fn().mockReturnValue({ temperature: asCelsius(25), irradiance: asRatio(1.0), wind: asRatio(0.5) }),
    };

    const generation = {
      id: asSystemId('generation'),
      init: vi.fn(),
      step: vi.fn(),
      reset: vi.fn(),
      dispose: vi.fn(),
      dispatch: vi.fn().mockReturnValue([]),
      totalOutput: vi.fn().mockReturnValue(asMegaWatts(50)),
      getGeneratorOutput: vi.fn().mockReturnValue(asMegaWatts(50)),
      tripGenerator: vi.fn(),
      untripGenerator: vi.fn(),
      isTripped: vi.fn().mockReturnValue(false),
      resetTrips: vi.fn(),
    };

    const loads = {
      id: asSystemId('loads'),
      init: vi.fn(),
      step: vi.fn(),
      reset: vi.fn(),
      dispose: vi.fn(),
      demand: vi.fn().mockReturnValue([]),
      totalDemand: vi.fn().mockReturnValue(asMegaWatts(50)),
      getLoadDemand: vi.fn().mockReturnValue(asMegaWatts(50)),
      shedLoad: vi.fn(),
      getShedFraction: vi.fn().mockReturnValue(0),
      resetShedding: vi.fn(),
    };

    const protection = {
      register: vi.fn(),
      evaluate: vi.fn().mockReturnValue({ trips: [], opened: [], decisions: [] }),
      breakerFor: vi.fn().mockReturnValue({ phase: 'Closed' }),
      relayFor: vi.fn(),
      thermalFor: vi.fn(),
      relays: vi.fn().mockReturnValue([]),
      breakers: vi.fn().mockReturnValue([]),
      thermals: vi.fn().mockReturnValue([]),
    };

    const cascade = {
      id: asSystemId('cascade'),
      init: vi.fn(),
      step: vi.fn(),
      reset: vi.fn(),
      dispose: vi.fn(),
      propagate: vi.fn().mockReturnValue({ active: false, step: 0, trippedLines: [] }),
      isActive: vi.fn().mockReturnValue(false),
    };

    const restoration = {
      id: asSystemId('restoration'),
      init: vi.fn(),
      step: vi.fn(),
      reset: vi.fn(),
      dispose: vi.fn(),
      plan: vi.fn(),
    };

    const director = {
      pace: vi.fn().mockReturnValue({ severity: 'Info', message: 'OK' }),
    };

    const engine = new GridSimulationEngine(
      graph,
      topo,
      weather as any,
      generation as any,
      loads as any,
      protection as any,
      cascade as any,
      restoration as any,
      director as any,
    );

    return { engine, weather, generation, loads, protection, cascade, restoration, director };
  };

  it('runs the tick pipeline in correct sequence', () => {
    const graph = createElectricalGraph({ now: () => 0 });
    graph.mutate((tx) => {
      tx.addBus({ id: 'b1' as any, nominalVoltageKv: 230 });
      tx.addBus({ id: 'b2' as any, nominalVoltageKv: 230 });
      tx.addLine({ id: asLineId('l1'), from: 'b1' as any, to: 'b2' as any, capacityMw: 100, reactancePu: 0.1 });
      tx.addGenerator({ id: asGeneratorId('g1'), busId: 'b1' as any, capacityMw: 100, generationKind: 'Baseload' as any });
      tx.addLoad({ id: 'ld1' as any, busId: 'b2' as any, nominalDemandMw: 50 });
    });

    const { engine, weather, generation, loads, protection, cascade, restoration, director } = setupMockEngine(graph);
    const ctx = makeMockContext();
    engine.init(ctx);

    engine.step({ tick: 1, time: 1 as any, timestep: 1 as any });

    // Assert that each subsystem step/dispatch/evaluate/plan is executed
    expect(weather.advance).toHaveBeenCalled();
    expect(loads.demand).toHaveBeenCalled();
    expect(generation.dispatch).toHaveBeenCalled();
    expect(protection.evaluate).toHaveBeenCalled();
    expect(cascade.propagate).toHaveBeenCalled();
    expect(restoration.plan).toHaveBeenCalled();
    expect(director.pace).toHaveBeenCalled();

    // Verify grid state computation
    const state = engine.getState();
    expect(state.totalGeneration).toBe(50);
    expect(state.totalLoad).toBe(50);
    expect(state.frequency).toBe(60);
    expect(state.lines).toHaveLength(1);
    expect(state.lines[0]?.line).toBe('l1');
    expect(state.lines[0]?.state).toBe('Nominal');
    expect(state.zones).toHaveLength(1);
    expect(state.zones[0]?.zone).toBe('Z1');
    expect(state.zones[0]?.state).toBe('Powered');

    // The kernel emits the single authoritative SimulationTick after all
    // systems have stepped — the engine must NOT emit its own duplicate.
    expect(ctx.emitSpy).not.toHaveBeenCalledWith(
      GRID_EVENT.SimulationTick,
      expect.anything(),
    );
  });

  it('bridges protection-opened lines onto the bus as LineTripped', () => {
    const graph = createElectricalGraph({ now: () => 0 });
    graph.mutate((tx) => {
      tx.addBus({ id: 'b1' as any, nominalVoltageKv: 230 });
      tx.addBus({ id: 'b2' as any, nominalVoltageKv: 230 });
      tx.addLine({ id: asLineId('l1'), from: 'b1' as any, to: 'b2' as any, capacityMw: 100, reactancePu: 0.1 });
      tx.addGenerator({ id: asGeneratorId('g1'), busId: 'b1' as any, capacityMw: 100, generationKind: 'Baseload' as any });
      tx.addLoad({ id: 'ld1' as any, busId: 'b2' as any, nominalDemandMw: 50 });
    });

    const { engine, protection } = setupMockEngine(graph);
    protection.evaluate.mockReturnValue({ trips: [], opened: [asLineId('l1')], decisions: [] });
    protection.relayFor = vi.fn().mockReturnValue({ lastTripTick: 1 });

    const ctx = makeMockContext();
    engine.init(ctx);
    engine.step({ tick: 1, time: 1 as any, timestep: 1 as any });

    expect(ctx.emitSpy).toHaveBeenCalledWith(GRID_EVENT.LineTripped, {
      line: asLineId('l1'),
      cause: 'Overload',
    });
  });
});
