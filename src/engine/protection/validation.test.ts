import { GenerationKind, asBusId, asGeneratorId, asLineId, asLoadId } from '@app-types';
import { describe, expect, it } from 'vitest';

import { createElectricalGraph } from '../graph';
import { DEFAULT_BREAKER_CONFIG, DEFAULT_RELAY_CONFIG, DEFAULT_THERMAL_CONFIG } from './config';
import { createProtectionEngine } from './protection-engine';
import { validateProtectionConfig, validateProtectionState } from './validation';

const l1 = asLineId('l1');

const check = (
  relay = DEFAULT_RELAY_CONFIG,
  thermal = DEFAULT_THERMAL_CONFIG,
  breaker = DEFAULT_BREAKER_CONFIG,
) => validateProtectionConfig(relay, thermal, breaker);

/** Minimal single-line graph for state validation tests. */
const singleLineGraph = () => {
  const graph = createElectricalGraph({ now: () => 0 });
  graph.mutate((tx) => {
    tx.addBus({ id: asBusId('b1'), nominalVoltageKv: 230 });
    tx.addBus({ id: asBusId('b2'), nominalVoltageKv: 230 });
    tx.addLine({ id: l1, from: asBusId('b1'), to: asBusId('b2'), capacityMw: 200, reactancePu: 0.1 });
    tx.addGenerator({
      id: asGeneratorId('g1'),
      busId: asBusId('b1'),
      capacityMw: 100,
      generationKind: GenerationKind.Baseload,
    });
    tx.addLoad({ id: asLoadId('ld1'), busId: asBusId('b2'), nominalDemandMw: 50 });
  });
  return graph;
};

describe('validateProtectionConfig', () => {
  it('accepts the defaults', () => {
    expect(check().valid).toBe(true);
  });

  it('rejects out-of-order thresholds', () => {
    const report = check({ ...DEFAULT_RELAY_CONFIG, pickupThreshold: 2, tripThreshold: 1 });
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'INVALID_THRESHOLD')).toBe(true);
  });

  it('rejects negative timing', () => {
    const report = check({ ...DEFAULT_RELAY_CONFIG, tripDelayS: -1 });
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'IMPOSSIBLE_TIMING')).toBe(true);
  });

  it('rejects a thermal warning at/above the safe limit', () => {
    const report = check(DEFAULT_RELAY_CONFIG, { ...DEFAULT_THERMAL_CONFIG, warningC: 95 });
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'INVALID_THRESHOLD')).toBe(true);
  });

  it('rejects a non-positive thermal time constant', () => {
    const report = check(DEFAULT_RELAY_CONFIG, { ...DEFAULT_THERMAL_CONFIG, timeConstantS: 0 });
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'IMPOSSIBLE_TIMING')).toBe(true);
  });

  // --- Additional config validation coverage --------------------------------

  it('rejects instantaneous threshold below pickup', () => {
    const report = check({
      ...DEFAULT_RELAY_CONFIG,
      instantaneousThreshold: 0.5, // below pickupThreshold (1.0)
    });
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'INVALID_THRESHOLD')).toBe(true);
  });

  it('rejects reset ratio of zero', () => {
    const report = check({ ...DEFAULT_RELAY_CONFIG, resetRatio: 0 });
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'INVALID_CONFIG')).toBe(true);
  });

  it('rejects reset ratio above 1', () => {
    const report = check({ ...DEFAULT_RELAY_CONFIG, resetRatio: 1.5 });
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'INVALID_CONFIG')).toBe(true);
  });

  it('rejects negative reset delay', () => {
    const report = check({ ...DEFAULT_RELAY_CONFIG, resetDelayS: -1 });
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'IMPOSSIBLE_TIMING')).toBe(true);
  });

  it('rejects negative coordination delay', () => {
    const report = check({ ...DEFAULT_RELAY_CONFIG, coordinationDelayS: -0.1 });
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'IMPOSSIBLE_TIMING')).toBe(true);
  });

  it('rejects negative rated temperature rise', () => {
    const report = check(DEFAULT_RELAY_CONFIG, { ...DEFAULT_THERMAL_CONFIG, ratedRiseC: -1 });
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'INVALID_CONFIG')).toBe(true);
  });

  it('rejects maxSafeC at or below ambient', () => {
    const report = check(DEFAULT_RELAY_CONFIG, { ...DEFAULT_THERMAL_CONFIG, maxSafeC: 24 });
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'INVALID_THRESHOLD')).toBe(true);
  });

  it('rejects ambient temperature below absolute zero', () => {
    const report = check(DEFAULT_RELAY_CONFIG, { ...DEFAULT_THERMAL_CONFIG, ambientC: -300 });
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'NEGATIVE_TEMPERATURE')).toBe(true);
  });

  it('rejects negative breaker operate time', () => {
    const report = check(DEFAULT_RELAY_CONFIG, DEFAULT_THERMAL_CONFIG, { operateTicks: -1 });
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'IMPOSSIBLE_TIMING')).toBe(true);
  });

  it('returns valid:true with zero issues for a legal config', () => {
    const result = check();
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});

describe('validateProtectionState', () => {
  it('passes for a freshly registered engine', () => {
    const graph = singleLineGraph();
    const engine = createProtectionEngine();
    engine.register(graph);
    const report = validateProtectionState(engine);
    expect(report.valid).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it('flags MISSING_BREAKER when a relay has no corresponding breaker', () => {
    // Build an engine and remove a breaker from the internal map to simulate corruption.
    // We do this by accessing the engine via the public API and verifying the validator catches it.
    // Direct hack: create an engine, register, then validate — all good. Then create a patched
    // engine that reports a relay without a breaker by returning mismatched arrays.
    const engine = createProtectionEngine();
    const graph = singleLineGraph();
    engine.register(graph);

    // Override to simulate a relay with no matching breaker
    const originalRelays = engine.relays();
    const patchedEngine = {
      ...engine,
      relays: () => originalRelays,
      breakerFor: (_line: unknown) => undefined, // never finds a breaker
      thermals: () => engine.thermals(),
    };
    const report = validateProtectionState(patchedEngine);
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'MISSING_BREAKER')).toBe(true);
  });

  it('flags INVALID_CONFIG when a thermal state has NaN temperature', () => {
    const engine = createProtectionEngine();
    const graph = singleLineGraph();
    engine.register(graph);

    const originalThermals = engine.thermals();
    const patchedEngine = {
      ...engine,
      relays: () => engine.relays(),
      breakerFor: (line: unknown) => engine.breakerFor(line as ReturnType<typeof asLineId>),
      thermals: () =>
        originalThermals.map((t) => ({ ...t, temperatureC: NaN })),
    };
    const report = validateProtectionState(patchedEngine);
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'INVALID_CONFIG')).toBe(true);
  });

  it('flags NEGATIVE_TEMPERATURE when thermal state is below absolute zero', () => {
    const engine = createProtectionEngine();
    const graph = singleLineGraph();
    engine.register(graph);

    const originalThermals = engine.thermals();
    const patchedEngine = {
      ...engine,
      relays: () => engine.relays(),
      breakerFor: (line: unknown) => engine.breakerFor(line as ReturnType<typeof asLineId>),
      thermals: () =>
        originalThermals.map((t) => ({ ...t, temperatureC: -300 })),
    };
    const report = validateProtectionState(patchedEngine);
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'NEGATIVE_TEMPERATURE')).toBe(true);
  });

  it('flags THERMAL_OVERFLOW when thermal state exceeds 10000°C', () => {
    const engine = createProtectionEngine();
    const graph = singleLineGraph();
    engine.register(graph);

    const originalThermals = engine.thermals();
    const patchedEngine = {
      ...engine,
      relays: () => engine.relays(),
      breakerFor: (line: unknown) => engine.breakerFor(line as ReturnType<typeof asLineId>),
      thermals: () =>
        originalThermals.map((t) => ({ ...t, temperatureC: 15000 })),
    };
    const report = validateProtectionState(patchedEngine);
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'THERMAL_OVERFLOW')).toBe(true);
  });

  it('accepts an engine with multiple healthy lines', () => {
    const graph = createElectricalGraph({ now: () => 0 });
    const l2 = asLineId('l2');
    graph.mutate((tx) => {
      tx.addBus({ id: asBusId('b1'), nominalVoltageKv: 230 });
      tx.addBus({ id: asBusId('b2'), nominalVoltageKv: 230 });
      tx.addBus({ id: asBusId('b3'), nominalVoltageKv: 230 });
      tx.addLine({ id: l1, from: asBusId('b1'), to: asBusId('b2'), capacityMw: 200, reactancePu: 0.1 });
      tx.addLine({ id: l2, from: asBusId('b2'), to: asBusId('b3'), capacityMw: 200, reactancePu: 0.1 });
      tx.addGenerator({
        id: asGeneratorId('g1'),
        busId: asBusId('b1'),
        capacityMw: 100,
        generationKind: GenerationKind.Baseload,
      });
      tx.addLoad({ id: asLoadId('ld1'), busId: asBusId('b3'), nominalDemandMw: 50 });
    });
    const engine = createProtectionEngine();
    engine.register(graph);
    const report = validateProtectionState(engine);
    expect(report.valid).toBe(true);
    expect(engine.relays()).toHaveLength(2);
    expect(engine.breakers()).toHaveLength(2);
  });
});
