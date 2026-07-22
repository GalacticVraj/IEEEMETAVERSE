import { asDecisionId, asSeconds } from '@app-types';
import { GRID_EVENT } from '@constants';
import type { GridEventBus } from '@core';
import { createSimulationKernel } from '@kernel';
import { beforeEach, describe, expect, it } from 'vitest';

import { LearnerTwin } from '../twin/learner-twin';

import { CONCEPT, conceptsForDecision } from './concepts';
import { createEvidenceEngine } from './evidence-engine';

interface FakeState {
  lines: { loading: number }[];
  zones: { state: string; unservedLoad: number }[];
  totalGeneration: number;
  totalLoad: number;
  renewableGeneration: number;
}

const makeHarness = () => {
  const bus = createSimulationKernel({ seed: 1 }).events as unknown as GridEventBus;
  const state: FakeState = {
    lines: [{ loading: 0.95 }],
    zones: [{ state: 'Powered', unservedLoad: 0 }],
    totalGeneration: 900,
    totalLoad: 1000,
    renewableGeneration: 100,
  };
  const engine = { getState: () => state } as never;
  const twin = new LearnerTwin(bus);
  const evidence = createEvidenceEngine({ bus, engine, twin, windowTicks: 10 });
  evidence.start();
  return { bus, state, twin, evidence };
};

const tick = (bus: GridEventBus, n: number): void => {
  bus.emit(GRID_EVENT.SimulationTick, { tick: n, simTime: asSeconds(n / 10), timestep: asSeconds(0.1) });
};

describe('concept catalog', () => {
  it('maps decisions to real concepts', () => {
    expect(conceptsForDecision('op-ac-residential-42')).toContain(CONCEPT.DemandResponse);
    expect(conceptsForDecision('op-shed-harbor-9')).toContain(CONCEPT.Equity);
    expect(conceptsForDecision('dec-cascade-120')).toContain(CONCEPT.CascadingFailure);
  });
});

describe('evidence engine', () => {
  beforeEach(() => undefined);

  it('measures a decision against real before/after telemetry (improved)', () => {
    const { bus, state, twin, evidence } = makeHarness();

    tick(bus, 100);
    bus.emit(GRID_EVENT.DecisionCommitted, {
      decisionId: asDecisionId('op-ac-residential-100'),
      optionIndex: 0,
      simTime: asSeconds(10),
    });

    // Simulation actually improves inside the evaluation window.
    state.lines[0]!.loading = 0.78;
    tick(bus, 111);

    const records = evidence.records();
    expect(records).toHaveLength(1);
    expect(records[0]?.verdict).toBe('improved');
    expect(records[0]?.pre.maxLoading).toBeCloseTo(0.95);
    expect(records[0]?.post?.maxLoading).toBeCloseTo(0.78);

    // The twin was fed with an optimal record → mastery above the 0.5 prior.
    expect(twin.masteryOf(CONCEPT.DemandResponse)).toBeGreaterThan(0.5);
  });

  it('judges no measurable effect honestly', () => {
    const { bus, state, evidence } = makeHarness();

    tick(bus, 100);
    bus.emit(GRID_EVENT.DecisionCommitted, {
      decisionId: asDecisionId('op-lights-commercial-100'),
      optionIndex: 0,
      simTime: asSeconds(10),
    });
    state.lines[0]!.loading = 0.945; // within noise threshold
    tick(bus, 111);

    expect(evidence.records()[0]?.verdict).toBe('no-effect');
  });

  it('detects worsening after a decision', () => {
    const { bus, state, evidence } = makeHarness();

    tick(bus, 100);
    bus.emit(GRID_EVENT.DecisionCommitted, {
      decisionId: asDecisionId('dec-overload-100'),
      optionIndex: 3,
      simTime: asSeconds(10),
    });
    state.lines[0]!.loading = 1.12;
    state.zones[0] = { state: 'Blackout', unservedLoad: 80 };
    tick(bus, 111);

    expect(evidence.records()[0]?.verdict).toBe('worsened');
  });

  it('measures response time from the matching DecisionRequested', () => {
    const { bus, evidence } = makeHarness();

    tick(bus, 50);
    bus.emit(GRID_EVENT.DecisionRequested, {
      decisionId: asDecisionId('dec-overload-50'),
      prompt: 'Choose:',
      options: ['a', 'b'],
    });
    tick(bus, 80);
    bus.emit(GRID_EVENT.DecisionCommitted, {
      decisionId: asDecisionId('dec-overload-50'),
      optionIndex: 0,
      simTime: asSeconds(8),
    });
    tick(bus, 95);

    expect(evidence.records()[0]?.responseTimeS).toBeCloseTo(3); // T+5s → T+8s
  });

  it('resets pending evaluations when the run restarts (tick regression)', () => {
    const { bus, evidence } = makeHarness();

    tick(bus, 100);
    bus.emit(GRID_EVENT.DecisionCommitted, {
      decisionId: asDecisionId('op-ev-pause-100'),
      optionIndex: 0,
      simTime: asSeconds(10),
    });
    tick(bus, 1); // restart
    tick(bus, 120);

    expect(evidence.records()).toHaveLength(0);
  });

  it('awards passive equity evidence when the hospital zone stays powered to the end', () => {
    const { bus, twin } = makeHarness();

    tick(bus, 100);
    bus.emit(GRID_EVENT.GameEnded, { outcome: 'Held', score: 100 });

    expect(twin.masteryOf(CONCEPT.Equity)).toBeGreaterThan(0.5);
  });
});
