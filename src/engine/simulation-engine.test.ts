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
        {
          id: asLineId('l1'),
          from: 'b1' as any,
          to: 'b2' as any,
          capacity: asMegaWatts(100),
          reactance: 0.1 as any,
        },
      ],
      generators: [
        {
          id: asGeneratorId('g1'),
          node: 'b1' as any,
          kind: 'Baseload' as any,
          capacity: asMegaWatts(100),
        },
      ],
      loads: [
        {
          id: 'ld1' as any,
          node: 'b2' as any,
          zone: 'Z1' as any,
          nominalDemand: asMegaWatts(50),
          critical: false,
        },
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
      advance: vi.fn().mockReturnValue({
        temperature: asCelsius(25),
        irradiance: asRatio(1.0),
        wind: asRatio(0.5),
      }),
      current: vi.fn().mockReturnValue({
        temperature: asCelsius(25),
        irradiance: asRatio(1.0),
        wind: asRatio(0.5),
      }),
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
      resetRelay: vi.fn(),
      commandOpen: vi.fn(),
      commandClose: vi.fn(),
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
      tx.addLine({
        id: asLineId('l1'),
        from: 'b1' as any,
        to: 'b2' as any,
        capacityMw: 100,
        reactancePu: 0.1,
      });
      tx.addGenerator({
        id: asGeneratorId('g1'),
        busId: 'b1' as any,
        capacityMw: 100,
        generationKind: 'Baseload' as any,
      });
      tx.addLoad({ id: 'ld1' as any, busId: 'b2' as any, nominalDemandMw: 50 });
    });

    const { engine, weather, generation, loads, protection, cascade, restoration, director } =
      setupMockEngine(graph);
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
    expect(ctx.emitSpy).not.toHaveBeenCalledWith(GRID_EVENT.SimulationTick, expect.anything());
  });

  it('bridges protection-opened lines onto the bus as LineTripped', () => {
    const graph = createElectricalGraph({ now: () => 0 });
    graph.mutate((tx) => {
      tx.addBus({ id: 'b1' as any, nominalVoltageKv: 230 });
      tx.addBus({ id: 'b2' as any, nominalVoltageKv: 230 });
      tx.addLine({
        id: asLineId('l1'),
        from: 'b1' as any,
        to: 'b2' as any,
        capacityMw: 100,
        reactancePu: 0.1,
      });
      tx.addGenerator({
        id: asGeneratorId('g1'),
        busId: 'b1' as any,
        capacityMw: 100,
        generationKind: 'Baseload' as any,
      });
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

  // -------------------------------------------------------------------------
  // Frequency dynamics — the algebraic placeholder is gone
  // -------------------------------------------------------------------------

  const makeGraph = () => {
    const graph = createElectricalGraph({ now: () => 0 });
    graph.mutate((tx) => {
      tx.addBus({ id: 'b1' as any, nominalVoltageKv: 230 });
      tx.addBus({ id: 'b2' as any, nominalVoltageKv: 230 });
      tx.addLine({
        id: asLineId('l1'),
        from: 'b1' as any,
        to: 'b2' as any,
        capacityMw: 100,
        reactancePu: 0.1,
      });
      tx.addGenerator({
        id: asGeneratorId('g1'),
        busId: 'b1' as any,
        capacityMw: 100,
        generationKind: 'Baseload' as any,
      });
      tx.addLoad({ id: 'ld1' as any, busId: 'b2' as any, nominalDemandMw: 50 });
    });
    return graph;
  };

  it('integrates frequency rather than computing it algebraically', () => {
    const { engine, generation } = setupMockEngine(makeGraph());
    engine.init(makeMockContext());

    // Hold a steady 20 MW deficit. The retired formula was memoryless — it
    // would report the SAME frequency on every tick. Real frequency keeps
    // falling for as long as the deficit persists.
    generation.totalOutput.mockReturnValue(asMegaWatts(30));

    engine.step({ tick: 1, time: 1 as any, timestep: 0.1 as any });
    const first = engine.getState().frequency as number;
    engine.step({ tick: 2, time: 2 as any, timestep: 0.1 as any });
    const second = engine.getState().frequency as number;

    expect(first).toBeLessThan(60);
    expect(second).toBeLessThan(first);
    expect(engine.getState().rocof).toBeLessThan(0);
    expect(first).toBeGreaterThan(55);
    expect(first).toBeLessThan(65);
  });

  it('holds nominal frequency while generation matches demand', () => {
    const { engine } = setupMockEngine(makeGraph());
    engine.init(makeMockContext());

    for (let tick = 1; tick <= 20; tick += 1) {
      engine.step({ tick, time: tick as any, timestep: 0.1 as any });
    }
    expect(engine.getState().frequency as number).toBeCloseTo(60, 6);
    expect(engine.getState().rocof).toBeCloseTo(0, 6);
  });

  it('publishes inertia, RoCoF and an N-1 verdict on GridState', () => {
    const { engine } = setupMockEngine(makeGraph());
    engine.init(makeMockContext());
    engine.step({ tick: 1, time: 1 as any, timestep: 0.1 as any });

    const state = engine.getState();
    // One 100 MW Baseload machine online: H=5 => 500 MW-s.
    expect(state.inertiaMwS).toBe(500);
    expect(Number.isFinite(state.rocof)).toBe(true);
    expect(['Secure', 'AtRisk', 'Insecure']).toContain(state.security);
    expect(state.uflsStage).toBe(0);
  });

  it('loses inertia when a synchronous machine trips', () => {
    const { engine, generation } = setupMockEngine(makeGraph());
    engine.init(makeMockContext());
    engine.step({ tick: 1, time: 1 as any, timestep: 0.1 as any });
    expect(engine.getState().inertiaMwS).toBe(500);

    generation.isTripped.mockReturnValue(true);
    engine.step({ tick: 2, time: 2 as any, timestep: 0.1 as any });
    expect(engine.getState().inertiaMwS).toBe(0);
  });

  it('restores nominal frequency after a reset', () => {
    const { engine, generation } = setupMockEngine(makeGraph());
    engine.init(makeMockContext());
    generation.totalOutput.mockReturnValue(asMegaWatts(10));
    for (let tick = 1; tick <= 10; tick += 1) {
      engine.step({ tick, time: tick as any, timestep: 0.1 as any });
    }
    expect(engine.getState().frequency as number).toBeLessThan(60);

    engine.reset();
    expect(engine.getState().frequency as number).toBe(60);
    expect(engine.getState().uflsStage).toBe(0);
  });

  it('actually disconnects load when UFLS fires', () => {
    // The relay computing a shed fraction is not enough — the load has to
    // really go away, or frequency never recovers and the automatic defence
    // is decorative. This is the whole lesson of UFLS: the grid survives by
    // making a district dark.
    const { engine, generation } = setupMockEngine(makeGraph());
    engine.init(makeMockContext());

    // Deep, sustained deficit: 50 MW of generation against 50 MW of demand
    // becomes 10 MW of generation.
    generation.totalOutput.mockReturnValue(asMegaWatts(10));
    for (let tick = 1; tick <= 400; tick += 1) {
      engine.step({ tick, time: tick as any, timestep: 0.1 as any });
    }

    const state = engine.getState();
    expect(state.uflsStage).toBeGreaterThanOrEqual(1);
    expect(state.uflsShedFraction).toBeGreaterThan(0);

    // The load model still WANTS 50 MW, but relays have disconnected part of
    // it, so the load actually connected to the grid must be lower.
    expect(state.totalLoad as number).toBeLessThan(50);
    expect(state.totalLoad as number).toBeCloseTo(50 * (1 - state.uflsShedFraction), 5);
  });

  // -------------------------------------------------------------------------
  // Restoration — the console cannot ask about a corridor it cannot see
  // -------------------------------------------------------------------------

  const openBreakerAt = (temperatureC: number, warningC = 75) => {
    const protectionPatch = {
      breakers: vi.fn().mockReturnValue([{ line: asLineId('l1'), phase: 'Open' }]),
      thermalFor: vi.fn().mockReturnValue({ temperatureC, config: { warningC } }),
    };
    return protectionPatch;
  };

  // -------------------------------------------------------------------------
  // Weather publication — the scene cannot react to what is never announced
  // -------------------------------------------------------------------------

  it('publishes the environment on the bus', () => {
    // `WeatherChanged` had TWO subscribers and no publisher, so `weatherKind`
    // sat on its initial 'Clear' for entire runs and every scene effect gated
    // on it — lightning included — was unreachable. A named "Coastal Storm"
    // could not render a storm no matter what the weather model computed.
    const { engine, weather } = setupMockEngine(makeGraph());
    weather.advance.mockReturnValue({
      kind: 'Storm',
      temperature: asCelsius(18),
      irradiance: asRatio(0.15),
      wind: asRatio(0.9),
    });

    const ctx = makeMockContext();
    engine.init(ctx);
    engine.step({ tick: 1, time: 1 as any, timestep: 0.1 as any });

    expect(ctx.emitSpy).toHaveBeenCalledWith(
      GRID_EVENT.WeatherChanged,
      expect.objectContaining({ kind: 'Storm', wind: 0.9, irradiance: 0.15 }),
    );
  });

  it('dedupes weather to real changes rather than emitting every tick', () => {
    // At 10 Hz an undeduped emit would put 1,800 weather events into a
    // 200-entry ring log and push every other event out of it.
    const { engine, weather } = setupMockEngine(makeGraph());
    weather.advance.mockReturnValue({
      kind: 'Clear',
      temperature: asCelsius(25),
      irradiance: asRatio(0.7),
      wind: asRatio(0.3),
    });

    const ctx = makeMockContext();
    engine.init(ctx);
    for (let tick = 1; tick <= 40; tick += 1) {
      engine.step({ tick, time: tick as any, timestep: 0.1 as any });
    }

    const weatherEmits = ctx.emitSpy.mock.calls.filter(
      ([name]) => name === GRID_EVENT.WeatherChanged,
    );
    expect(weatherEmits).toHaveLength(1);
  });

  it('publishes again once the environment has actually moved', () => {
    const { engine, weather } = setupMockEngine(makeGraph());
    const clear = {
      kind: 'Clear',
      temperature: asCelsius(25),
      irradiance: asRatio(0.7),
      wind: asRatio(0.3),
    };
    weather.advance.mockReturnValue(clear);

    const ctx = makeMockContext();
    engine.init(ctx);
    engine.step({ tick: 1, time: 1 as any, timestep: 0.1 as any });

    // A cloud bank crossing the array is exactly the kind of change the
    // forecast panel and the solar farm both need to hear about.
    weather.advance.mockReturnValue({ ...clear, irradiance: asRatio(0.32) });
    engine.step({ tick: 2, time: 2 as any, timestep: 0.1 as any });

    const weatherEmits = ctx.emitSpy.mock.calls.filter(
      ([name]) => name === GRID_EVENT.WeatherChanged,
    );
    expect(weatherEmits).toHaveLength(2);
  });

  it('projects reclose readiness for every OPEN corridor', () => {
    // A tripped line is removed from the graph, so it never appears in the
    // power flow and never appears in `lines`. Without this projection the
    // console has no way to know a corridor exists, let alone how hot it is.
    const { engine, protection } = setupMockEngine(makeGraph());
    Object.assign(protection, openBreakerAt(94));
    engine.init(makeMockContext());
    engine.step({ tick: 1, time: 1 as any, timestep: 0.1 as any });

    const [entry] = engine.getState().restoration;
    expect(entry).toBeDefined();
    expect(entry?.line).toBe(asLineId('l1'));
    expect(entry?.conductorTempC).toBe(94);
    expect(entry?.recloseBelowC).toBe(75);
    expect(entry?.readyToReclose).toBe(false);
  });

  it('reports a cooled corridor as ready, using the automatic controller threshold', () => {
    const { engine, protection } = setupMockEngine(makeGraph());
    Object.assign(protection, openBreakerAt(60));
    engine.init(makeMockContext());
    engine.step({ tick: 1, time: 1 as any, timestep: 0.1 as any });

    expect(engine.getState().restoration[0]?.readyToReclose).toBe(true);
  });

  it('leaves the restoration list empty while every breaker is closed', () => {
    const { engine } = setupMockEngine(makeGraph());
    engine.init(makeMockContext());
    engine.step({ tick: 1, time: 1 as any, timestep: 0.1 as any });

    expect(engine.getState().restoration).toEqual([]);
  });

  it('honours an operator reclose request on an open corridor', () => {
    // The line id contains hyphens in the real topology, which is exactly why
    // the decision id is pipe-delimited — the other handlers here match by
    // substring and would shred it.
    const { engine, protection } = setupMockEngine(makeGraph());
    protection.breakerFor = vi.fn().mockReturnValue({ phase: 'Open' });
    const ctx = makeMockContext();
    engine.init(ctx);

    ctx.events.emit(GRID_EVENT.DecisionCommitted, {
      decisionId: 'op-reclose|DT4-HB1|420',
      optionIndex: 0,
      simTime: 42 as any,
    } as any);

    expect(protection.resetRelay).toHaveBeenCalledWith(asLineId('DT4-HB1'));
    expect(protection.commandClose).toHaveBeenCalledWith(asLineId('DT4-HB1'), 1);
  });

  it('ignores a reclose request for a corridor that is already closed', () => {
    const { engine, protection } = setupMockEngine(makeGraph());
    protection.breakerFor = vi.fn().mockReturnValue({ phase: 'Closed' });
    const ctx = makeMockContext();
    engine.init(ctx);

    ctx.events.emit(GRID_EVENT.DecisionCommitted, {
      decisionId: 'op-reclose|l1|10',
      optionIndex: 0,
      simTime: 1 as any,
    } as any);

    expect(protection.commandClose).not.toHaveBeenCalled();
  });

  it('does not let a reclose request fall through into the load-shed handlers', () => {
    // `op-reclose|...` must not be mistaken for one of the `op-*` shed levers
    // by the substring matching the other branches use.
    const { engine, loads, protection } = setupMockEngine(makeGraph());
    protection.breakerFor = vi.fn().mockReturnValue({ phase: 'Open' });
    const ctx = makeMockContext();
    engine.init(ctx);

    ctx.events.emit(GRID_EVENT.DecisionCommitted, {
      decisionId: 'op-reclose|l1|10',
      optionIndex: 0,
      simTime: 1 as any,
    } as any);

    expect(loads.shedLoad).not.toHaveBeenCalled();
  });
});
