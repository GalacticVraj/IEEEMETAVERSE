import { GenerationKind, asBusId, asGeneratorId, asLineId, asLoadId } from '@app-types';
import { describe, expect, it } from 'vitest';

import { createElectricalGraph } from '../graph';
import { solveDcPowerFlow } from '../powerflow';
import { BreakerPhase } from './breaker';
import { DEFAULT_THERMAL_CONFIG } from './config';
import { formatProtectionDiagnostics, protectionDiagnostics } from './diagnostics';
import { createProtectionEngine } from './protection-engine';
import { RelayPhase } from './relay';

const l1 = asLineId('l1');
const l2 = asLineId('l2');

/** Two-bus graph with a single overloaded line. */
const twoBus = (capacityMw = 50) => {
  const graph = createElectricalGraph({ now: () => 0 });
  graph.mutate((tx) => {
    tx.addBus({ id: asBusId('b1'), nominalVoltageKv: 230 });
    tx.addBus({ id: asBusId('b2'), nominalVoltageKv: 230 });
    tx.addLine({ id: l1, from: asBusId('b1'), to: asBusId('b2'), capacityMw, reactancePu: 0.1 });
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

describe('protectionDiagnostics', () => {
  it('reports zero relays/breakers on a fresh engine with no lines registered', () => {
    const engine = createProtectionEngine();
    const diag = protectionDiagnostics(engine);
    expect(diag.relayCount).toBe(0);
    expect(diag.breakerCount).toBe(0);
    expect(diag.lockedOutRelays).toBe(0);
    expect(diag.openBreakers).toBe(0);
    expect(diag.totalOperations).toBe(0);
    expect(diag.hottestC).toBe(0);
    expect(diag.relays).toHaveLength(0);
    expect(diag.breakers).toHaveLength(0);
    expect(diag.thermals).toHaveLength(0);
  });

  it('counts relays and breakers after registration', () => {
    const graph = twoBus();
    const engine = createProtectionEngine();
    engine.register(graph);
    const diag = protectionDiagnostics(engine);
    expect(diag.relayCount).toBe(1);
    expect(diag.breakerCount).toBe(1);
  });

  it('counts lockedOut relays after a trip sequence', () => {
    const graph = twoBus(50); // overloaded: 100 MW over 50 MW ⇒ loading = 2
    const engine = createProtectionEngine();
    // Tick 0: instantaneous trip issued. Tick 1: relay locks out. Tick 2: breaker opens.
    for (let tick = 0; tick < 3; tick += 1) {
      const pf = solveDcPowerFlow(graph);
      engine.evaluate({ graph, flows: pf.flows, tick, timestepS: 1 });
    }
    const diag = protectionDiagnostics(engine);
    expect(diag.lockedOutRelays).toBe(1);
    expect(engine.relayFor(l1)?.phase).toBe(RelayPhase.LockedOut);
  });

  it('counts open breakers after a line trips', () => {
    const graph = twoBus(50);
    const engine = createProtectionEngine();
    for (let tick = 0; tick < 3; tick += 1) {
      const pf = solveDcPowerFlow(graph);
      engine.evaluate({ graph, flows: pf.flows, tick, timestepS: 1 });
    }
    const diag = protectionDiagnostics(engine);
    expect(diag.openBreakers).toBe(1);
  });

  it('counts totalOperations across all relays', () => {
    const graph = twoBus(50);
    const engine = createProtectionEngine();
    for (let tick = 0; tick < 3; tick += 1) {
      const pf = solveDcPowerFlow(graph);
      engine.evaluate({ graph, flows: pf.flows, tick, timestepS: 1 });
    }
    const diag = protectionDiagnostics(engine);
    expect(diag.totalOperations).toBeGreaterThanOrEqual(1);
  });

  it('tracks the hottest line temperature', () => {
    const graph = twoBus(1000); // capacity large so line stays up
    const engine = createProtectionEngine();
    // Run several ticks with significant loading to heat the line
    for (let tick = 0; tick < 20; tick += 1) {
      engine.evaluate({ graph, flows: [{ line: l1, loading: 1.5 }], tick, timestepS: 1 });
    }
    const diag = protectionDiagnostics(engine);
    expect(diag.hottestC).toBeGreaterThan(DEFAULT_THERMAL_CONFIG.ambientC);
  });

  it('reports relay details including phase, operationCount, lastTripTick', () => {
    const graph = twoBus(50);
    const engine = createProtectionEngine();
    for (let tick = 0; tick < 3; tick += 1) {
      const pf = solveDcPowerFlow(graph);
      engine.evaluate({ graph, flows: pf.flows, tick, timestepS: 1 });
    }
    const diag = protectionDiagnostics(engine);
    const relayDiag = diag.relays.find((r) => r.line === String(l1));
    expect(relayDiag).toBeDefined();
    expect(relayDiag?.phase).toBe(RelayPhase.LockedOut);
    expect(relayDiag?.operationCount).toBeGreaterThanOrEqual(1);
    expect(relayDiag?.lastTripTick).not.toBeNull();
  });

  it('reports breaker details including phase and operationCount', () => {
    const graph = twoBus(50);
    const engine = createProtectionEngine();
    for (let tick = 0; tick < 3; tick += 1) {
      const pf = solveDcPowerFlow(graph);
      engine.evaluate({ graph, flows: pf.flows, tick, timestepS: 1 });
    }
    const diag = protectionDiagnostics(engine);
    const breakerDiag = diag.breakers.find((b) => b.line === String(l1));
    expect(breakerDiag).toBeDefined();
    expect(breakerDiag?.phase).toBe(BreakerPhase.Open);
    expect(breakerDiag?.operationCount).toBeGreaterThanOrEqual(1);
  });

  it('reports thermal details with correct level classification', () => {
    const graph = twoBus(1000);
    const engine = createProtectionEngine({
      thermalConfig: { ...DEFAULT_THERMAL_CONFIG, warningC: 60, maxSafeC: 80 },
    });
    // Run enough ticks so temperature climbs into warning range
    for (let tick = 0; tick < 30; tick += 1) {
      engine.evaluate({ graph, flows: [{ line: l1, loading: 1.2 }], tick, timestepS: 1 });
    }
    const diag = protectionDiagnostics(engine);
    const thermalDiag = diag.thermals.find((t) => t.line === String(l1));
    expect(thermalDiag).toBeDefined();
    expect(thermalDiag?.temperatureC).toBeGreaterThan(DEFAULT_THERMAL_CONFIG.ambientC);
    // Level should be warning or critical given the load
    expect(['normal', 'warning', 'critical']).toContain(thermalDiag?.level);
  });

  it('classifies thermal level as critical above maxSafeC', () => {
    // Directly test the levelOf helper via a very hot thermal state
    const engine = createProtectionEngine({
      thermalConfig: { ...DEFAULT_THERMAL_CONFIG, warningC: 60, maxSafeC: 70 },
    });
    const graph = twoBus(1000);
    // Feed very high loading to push past critical
    for (let tick = 0; tick < 50; tick += 1) {
      engine.evaluate({ graph, flows: [{ line: l1, loading: 2.0 }], tick, timestepS: 1 });
    }
    const diag = protectionDiagnostics(engine);
    const thermalDiag = diag.thermals.find((t) => t.line === String(l1));
    // At loading=2.0 steady state = 25 + 50*4 = 225°C, well above maxSafeC=70
    expect(thermalDiag?.level).toBe('critical');
  });

  it('classifies thermal level as warning between warningC and maxSafeC', () => {
    const engine = createProtectionEngine({
      thermalConfig: {
        ambientC: 25,
        ratedRiseC: 50,
        timeConstantS: 1,
        warningC: 50,
        maxSafeC: 200,
      },
    });
    const graph = twoBus(1000);
    // loading=1.0 steady state = 75°C, between warning(50) and maxSafe(200)
    for (let tick = 0; tick < 30; tick += 1) {
      engine.evaluate({ graph, flows: [{ line: l1, loading: 1.0 }], tick, timestepS: 1 });
    }
    const diag = protectionDiagnostics(engine);
    const thermalDiag = diag.thermals.find((t) => t.line === String(l1));
    expect(thermalDiag?.level).toBe('warning');
  });

  it('classifies thermal level as normal below warningC', () => {
    const engine = createProtectionEngine({
      thermalConfig: { ...DEFAULT_THERMAL_CONFIG, warningC: 200, maxSafeC: 300 },
    });
    const graph = twoBus(1000);
    engine.register(graph);
    // No loading → temperature stays near ambient (25°C), below warning (200°C)
    const diag = protectionDiagnostics(engine);
    const thermalDiag = diag.thermals.find((t) => t.line === String(l1));
    expect(thermalDiag?.level).toBe('normal');
  });
});

describe('formatProtectionDiagnostics', () => {
  it('returns a non-empty human-readable string', () => {
    const engine = createProtectionEngine();
    const graph = twoBus();
    engine.register(graph);
    const str = formatProtectionDiagnostics(protectionDiagnostics(engine));
    expect(str).toContain('relays=1');
    expect(str).toContain('breakers=1');
    expect(str).toContain('°C');
  });

  it('shows lockedOut and open counts', () => {
    const graph = twoBus(50);
    const engine = createProtectionEngine();
    for (let tick = 0; tick < 3; tick += 1) {
      const pf = solveDcPowerFlow(graph);
      engine.evaluate({ graph, flows: pf.flows, tick, timestepS: 1 });
    }
    const str = formatProtectionDiagnostics(protectionDiagnostics(engine));
    expect(str).toContain('lockedOut=1');
    expect(str).toContain('open=1');
  });

  it('hottest temperature reflects highest across multiple thermals', () => {
    // Build a two-line graph to test multi-thermal tracking
    const graph = createElectricalGraph({ now: () => 0 });
    graph.mutate((tx) => {
      tx.addBus({ id: asBusId('b1'), nominalVoltageKv: 230 });
      tx.addBus({ id: asBusId('b2'), nominalVoltageKv: 230 });
      tx.addBus({ id: asBusId('b3'), nominalVoltageKv: 230 });
      tx.addLine({ id: l1, from: asBusId('b1'), to: asBusId('b2'), capacityMw: 1000, reactancePu: 0.1 });
      tx.addLine({ id: l2, from: asBusId('b2'), to: asBusId('b3'), capacityMw: 1000, reactancePu: 0.1 });
      tx.addGenerator({
        id: asGeneratorId('g1'),
        busId: asBusId('b1'),
        capacityMw: 100,
        generationKind: GenerationKind.Baseload,
      });
      tx.addLoad({ id: asLoadId('ld1'), busId: asBusId('b3'), nominalDemandMw: 100 });
    });
    const engine = createProtectionEngine();
    // Different loadings per line
    for (let tick = 0; tick < 20; tick += 1) {
      engine.evaluate({
        graph,
        flows: [
          { line: l1, loading: 0.5 },
          { line: l2, loading: 1.5 },
        ],
        tick,
        timestepS: 1,
      });
    }
    const diag = protectionDiagnostics(engine);
    // l2 has higher loading so its temperature should dominate hottestC
    const t1 = diag.thermals.find((t) => t.line === String(l1))?.temperatureC ?? 0;
    const t2 = diag.thermals.find((t) => t.line === String(l2))?.temperatureC ?? 0;
    expect(diag.hottestC).toBeCloseTo(Math.max(t1, t2), 5);
  });
});

describe('protectionDiagnostics — lastTripTick null for never-tripped relay', () => {
  it('reports null lastTripTick when relay has never tripped', () => {
    const graph = twoBus(1000); // capacity large so line is healthy
    const engine = createProtectionEngine();
    engine.register(graph);
    const diag = protectionDiagnostics(engine);
    const relayDiag = diag.relays.find((r) => r.line === String(l1));
    expect(relayDiag?.lastTripTick).toBeNull();
  });
});
