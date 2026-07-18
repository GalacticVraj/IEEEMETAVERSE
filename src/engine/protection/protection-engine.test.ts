import { GenerationKind, asBusId, asGeneratorId, asLineId, asLoadId } from '@app-types';
import { createEventBus } from '@core';
import { describe, expect, it, vi } from 'vitest';

import { createElectricalGraph } from '../graph';
import type { ElectricalGraph } from '../graph';
import { solveDcPowerFlow } from '../powerflow';
import { BreakerPhase } from './breaker';
import { DEFAULT_RELAY_CONFIG, ProtectionCurveType } from './config';
import type { RelayConfig } from './config';
import { createProtectionEngine } from './protection-engine';
import { PROTECTION_EVENT } from './protection-events';
import type { ProtectionEventMap } from './protection-events';
import { RelayPhase, createRelay, stepRelay } from './relay';

const l1 = asLineId('l1');

const twoBus = (capacityMw: number): ElectricalGraph => {
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

describe('ProtectionEngine — integration', () => {
  it('trips an overloaded line and removes it via a graph transaction', () => {
    const graph = twoBus(50); // 100 MW over a 50 MW line ⇒ loading 2
    const versionBefore = graph.version;
    const engine = createProtectionEngine();
    for (let tick = 0; tick < 3; tick += 1) {
      const pf = solveDcPowerFlow(graph);
      engine.evaluate({ graph, flows: pf.flows, tick, timestepS: 1 });
    }
    expect(graph.getLine(l1)).toBeUndefined(); // removed only via transaction
    expect(graph.version).toBeGreaterThan(versionBefore);
    expect(engine.breakerFor(l1)?.phase).toBe(BreakerPhase.Open);
    expect(engine.relayFor(l1)?.phase).toBe(RelayPhase.LockedOut);
  });

  it('never mutates topology except through the transaction (line present until breaker opens)', () => {
    const graph = twoBus(50);
    const engine = createProtectionEngine();
    const pf = solveDcPowerFlow(graph);
    engine.evaluate({ graph, flows: pf.flows, tick: 0, timestepS: 1 }); // trip issued, breaker opening
    expect(graph.getLine(l1)).toBeDefined(); // NOT yet removed (breaker still opening)
    expect(engine.breakerFor(l1)?.phase).toBe(BreakerPhase.Opening);
  });

  it('emits protection events', () => {
    const events = createEventBus<ProtectionEventMap>();
    const tripped = vi.fn();
    const completed = vi.fn();
    events.on(PROTECTION_EVENT.RelayTripIssued, tripped);
    events.on(PROTECTION_EVENT.ProtectionEvaluationCompleted, completed);
    const graph = twoBus(50);
    const engine = createProtectionEngine({ events });
    const pf = solveDcPowerFlow(graph);
    engine.evaluate({ graph, flows: pf.flows, tick: 0, timestepS: 1 });
    expect(tripped).toHaveBeenCalledTimes(1);
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it('trips on sustained thermal overload (synthetic loading)', () => {
    const graph = twoBus(1000); // capacity irrelevant; we feed loading directly
    const config: RelayConfig = {
      ...DEFAULT_RELAY_CONFIG,
      curve: ProtectionCurveType.DefiniteTime,
      tripDelayS: 1000, // suppress the timed trip so the thermal trip wins
      instantaneousTrip: false,
    };
    const engine = createProtectionEngine({ relayConfig: config });
    let thermalTrip = false;
    for (let tick = 0; tick < 15; tick += 1) {
      const result = engine.evaluate({
        graph,
        flows: [{ line: l1, loading: 1.4 }],
        tick,
        timestepS: 1,
      });
      const decision = result.decisions.find((d) => d.line === l1);
      if (decision?.trip) {
        thermalTrip = decision.reason === 'thermal';
        break;
      }
    }
    expect(thermalTrip).toBe(true);
  });

  it('is deterministic across identical runs', () => {
    const run = () => {
      const graph = twoBus(50);
      const engine = createProtectionEngine();
      for (let tick = 0; tick < 3; tick += 1) {
        engine.evaluate({ graph, flows: solveDcPowerFlow(graph).flows, tick, timestepS: 1 });
      }
      return engine.relayFor(l1);
    };
    expect(run()).toEqual(run());
  });
});

describe('ProtectionEngine — coordination', () => {
  it('a primary relay trips before a coordinated backup', () => {
    const line = l1;
    const base: RelayConfig = {
      ...DEFAULT_RELAY_CONFIG,
      curve: ProtectionCurveType.DefiniteTime,
      instantaneousTrip: false,
    };
    const drive = (config: RelayConfig): number => {
      let relay = createRelay('r', line, config);
      for (let tick = 0; tick < 6; tick += 1) {
        const result = stepRelay(
          relay,
          { loading: 1.2, thermalCritical: false, breakerClosed: true },
          tick,
          1,
        );
        relay = result.relay;
        if (result.decision.trip) return tick;
      }
      return -1;
    };
    const primaryTick = drive({ ...base, role: 'primary' });
    const backupTick = drive({ ...base, role: 'backup', coordinationDelayS: 0.5 });
    expect(primaryTick).toBeGreaterThan(0);
    expect(primaryTick).toBeLessThan(backupTick);
  });
});
