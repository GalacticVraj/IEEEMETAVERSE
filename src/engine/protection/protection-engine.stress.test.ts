/**
 * Protection Engine — stress tests.
 *
 * Verifies that the protection engine scales linearly to thousands of relays
 * and remains deterministic under load. Does NOT test cascade or restoration.
 */
import { GenerationKind, asBusId, asGeneratorId, asLineId, asLoadId } from '@app-types';
import { describe, expect, it } from 'vitest';

import { createElectricalGraph } from '../graph';
import type { ElectricalGraph } from '../graph';
import { DEFAULT_RELAY_CONFIG, ProtectionCurveType } from './config';
import { protectionDiagnostics } from './diagnostics';
import { createProtectionEngine } from './protection-engine';

/** Build a radial graph: hub (b0) fans out to N spoke buses, each connected by one line. */
const radialGraph = (spokes: number, capacityMw = 200): ElectricalGraph => {
  const graph = createElectricalGraph({ now: () => 0 });
  graph.mutate((tx) => {
    tx.addBus({ id: asBusId('b0'), nominalVoltageKv: 230 });
    tx.addGenerator({
      id: asGeneratorId('g0'),
      busId: asBusId('b0'),
      capacityMw: spokes * 100,
      generationKind: GenerationKind.Baseload,
    });
    for (let i = 1; i <= spokes; i += 1) {
      const busId = asBusId(`b${i}`);
      const lineId = asLineId(`l${i}`);
      const loadId = asLoadId(`ld${i}`);
      tx.addBus({ id: busId, nominalVoltageKv: 230 });
      tx.addLine({ id: lineId, from: asBusId('b0'), to: busId, capacityMw, reactancePu: 0.05 });
      tx.addLoad({ id: loadId, busId, nominalDemandMw: 50 });
    }
  });
  return graph;
};

describe('ProtectionEngine — stress tests', () => {
  it('registers and evaluates 500 relays in a single tick without throwing', () => {
    const graph = radialGraph(500);
    const engine = createProtectionEngine();
    expect(() => {
      engine.evaluate({
        graph,
        flows: [], // zero flows → loading = 0, no trips
        tick: 0,
        timestepS: 1,
      });
    }).not.toThrow();
    expect(engine.relays()).toHaveLength(500);
    expect(engine.breakers()).toHaveLength(500);
  });

  it('handles 1000 relays across 10 ticks deterministically', () => {
    const run = () => {
      const graph = radialGraph(1000);
      const engine = createProtectionEngine();
      for (let tick = 0; tick < 10; tick += 1) {
        engine.evaluate({ graph, flows: [], tick, timestepS: 1 });
      }
      return {
        relayCount: engine.relays().length,
        breakerCount: engine.breakers().length,
        thermalCount: engine.thermals().length,
      };
    };
    expect(run()).toEqual(run());
  });

  it('thermal model advances for all lines without NaN temperatures', () => {
    const spokes = 200;
    const graph = radialGraph(spokes);
    const engine = createProtectionEngine();
    for (let tick = 0; tick < 5; tick += 1) {
      engine.evaluate({
        graph,
        flows: Array.from({ length: spokes }, (_, i) => ({
          line: asLineId(`l${i + 1}`),
          loading: 0.8,
        })),
        tick,
        timestepS: 1,
      });
    }
    for (const thermal of engine.thermals()) {
      expect(Number.isNaN(thermal.temperatureC)).toBe(false);
      expect(Number.isFinite(thermal.temperatureC)).toBe(true);
    }
  });

  it('scales linearly: 100-relay evaluation is faster than 1000-relay × 15x', () => {
    const measure = (spokes: number) => {
      const graph = radialGraph(spokes);
      const engine = createProtectionEngine();
      const start = Date.now();
      engine.evaluate({ graph, flows: [], tick: 0, timestepS: 1 });
      return Date.now() - start;
    };
    const t100 = measure(100);
    const t1000 = measure(1000);
    // Linear scaling allows at most 15× for 10× more relays (generous budget).
    expect(t1000).toBeLessThanOrEqual(Math.max(t100 * 15, 500));
  });

  it('diagnostics are consistent after many-tick evaluation', () => {
    const graph = radialGraph(100);
    const engine = createProtectionEngine({
      relayConfig: {
        ...DEFAULT_RELAY_CONFIG,
        curve: ProtectionCurveType.DefiniteTime,
        instantaneousTrip: false,
      },
    });
    for (let tick = 0; tick < 20; tick += 1) {
      engine.evaluate({
        graph,
        flows: Array.from({ length: 100 }, (_, i) => ({
          line: asLineId(`l${i + 1}`),
          loading: 0.5, // below pickup, no trips
        })),
        tick,
        timestepS: 1,
      });
    }
    const diag = protectionDiagnostics(engine);
    expect(diag.lockedOutRelays).toBe(0);
    expect(diag.openBreakers).toBe(0);
    // Temperature should have risen from ambient due to 0.5 loading
    expect(diag.hottestC).toBeGreaterThan(25);
  });
});

describe('ProtectionEngine — edge cases', () => {
  it('evaluate is a no-op on a graph with no lines', () => {
    const graph = createElectricalGraph({ now: () => 0 });
    graph.mutate((tx) => {
      tx.addBus({ id: asBusId('b1'), nominalVoltageKv: 230 });
    });
    const engine = createProtectionEngine();
    const result = engine.evaluate({ graph, flows: [], tick: 0, timestepS: 1 });
    expect(result.trips).toHaveLength(0);
    expect(result.opened).toHaveLength(0);
    expect(result.decisions).toHaveLength(0);
  });

  it('unknown line IDs in flows are silently ignored (loading defaults to 0)', () => {
    const graph = radialGraph(1, 1000);
    const engine = createProtectionEngine();
    // Provide a flow for a nonexistent line — should not throw
    expect(() => {
      engine.evaluate({
        graph,
        flows: [{ line: asLineId('nonexistent'), loading: 5 }],
        tick: 0,
        timestepS: 1,
      });
    }).not.toThrow();
  });

  it('calling register twice does not create duplicate relays', () => {
    const graph = radialGraph(5);
    const engine = createProtectionEngine();
    engine.register(graph);
    engine.register(graph); // second call must be idempotent
    expect(engine.relays()).toHaveLength(5);
    expect(engine.breakers()).toHaveLength(5);
  });

  it('graph version increments only when a breaker opens (topology mutation)', () => {
    const graph = radialGraph(1, 50); // 50 MW line; single load can overload it
    // Override load so power flow gives loading > 1.5 (instantaneous threshold)
    const vBefore = graph.version;
    const engine = createProtectionEngine();
    // Tick 0: instantaneous trip issued
    engine.evaluate({
      graph,
      flows: [{ line: asLineId('l1'), loading: 2.0 }],
      tick: 0,
      timestepS: 1,
    });
    // At tick 0, breaker started Opening but not yet Open (operateTicks=1, elapsed=0).
    expect(graph.version).toBe(vBefore); // topology NOT changed yet

    // Tick 1: breaker reaches Open → graph.mutate called
    engine.evaluate({
      graph,
      flows: [{ line: asLineId('l1'), loading: 2.0 }],
      tick: 1,
      timestepS: 1,
    });
    expect(graph.version).toBeGreaterThan(vBefore); // NOW the mutation happened
  });

  it('temperature history: successive ticks produce non-decreasing temperature under constant load', () => {
    const graph = radialGraph(1, 1000); // large capacity so no trip
    const engine = createProtectionEngine();
    const temps: number[] = [];
    for (let tick = 0; tick < 10; tick += 1) {
      engine.evaluate({
        graph,
        flows: [{ line: asLineId('l1'), loading: 1.5 }],
        tick,
        timestepS: 1,
      });
      temps.push(engine.thermalFor(asLineId('l1'))!.temperatureC);
    }
    // The RC thermal model relaxes exponentially toward steady state; temperature
    // is non-decreasing (can become indistinguishable at floating-point scale
    // once the model converges, but must never fall).
    for (let i = 1; i < temps.length; i += 1) {
      expect(temps[i]).toBeGreaterThanOrEqual(temps[i - 1]!);
    }
    // And the final temperature must be clearly above ambient (25°C).
    expect(temps[temps.length - 1]).toBeGreaterThan(50);
  });

  it('multiple simultaneous overloads are all tripped independently', () => {
    const graph = radialGraph(3, 10); // 10 MW capacity lines, all heavily overloaded
    const engine = createProtectionEngine();
    // Tick 0: all 3 lines see loading = 2 (instantaneous trip)
    engine.evaluate({
      graph,
      flows: [
        { line: asLineId('l1'), loading: 2 },
        { line: asLineId('l2'), loading: 2 },
        { line: asLineId('l3'), loading: 2 },
      ],
      tick: 0,
      timestepS: 1,
    });
    // Tick 1: breakers finish opening, topology mutation fires
    engine.evaluate({
      graph,
      flows: [
        { line: asLineId('l1'), loading: 2 },
        { line: asLineId('l2'), loading: 2 },
        { line: asLineId('l3'), loading: 2 },
      ],
      tick: 1,
      timestepS: 1,
    });
    // All 3 lines should have been removed from the graph
    expect(graph.getLine(asLineId('l1'))).toBeUndefined();
    expect(graph.getLine(asLineId('l2'))).toBeUndefined();
    expect(graph.getLine(asLineId('l3'))).toBeUndefined();
  });
});
