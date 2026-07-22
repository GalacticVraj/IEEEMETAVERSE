import { asDecisionId, asSeconds } from '@app-types';
import { createSimulationKernel } from '@kernel';
import type { GridEventBus } from '@core';
import { describe, expect, it } from 'vitest';

import { CONCEPT } from '../evidence/concepts';

import { LearnerTwin } from './learner-twin';

const makeTwin = (): LearnerTwin =>
  new LearnerTwin(createSimulationKernel({ seed: 1 }).events as unknown as GridEventBus);

const decision = (optimal: boolean, concepts: string[] = [CONCEPT.DemandResponse]) => ({
  decisionId: asDecisionId('op-ac-residential-1'),
  optionIndex: 0,
  simTime: asSeconds(1),
  concepts,
  optimal,
  responseTime: asSeconds(2),
});

describe('LearnerTwin — evidence-based mastery', () => {
  it('mastery rises with optimal evidence and falls with poor outcomes', () => {
    const twin = makeTwin();
    twin.observeDecision(decision(true));
    const up = twin.masteryOf(CONCEPT.DemandResponse) as number;
    expect(up).toBeGreaterThan(0.5);
    twin.observeDecision(decision(false));
    expect(twin.masteryOf(CONCEPT.DemandResponse) as number).toBeLessThan(up);
  });

  it('confidence increases ONLY with evidence count, monotonically', () => {
    const twin = makeTwin();
    const confidences: number[] = [];
    for (let i = 0; i < 5; i++) {
      twin.observeDecision(decision(i % 2 === 0));
      const concept = twin.state().concepts.find((c) => c.concept === CONCEPT.DemandResponse);
      confidences.push(concept?.confidence ?? 0);
      expect(concept?.evidenceCount).toBe(i + 1);
    }
    for (let i = 1; i < confidences.length; i++) {
      expect(confidences[i]!).toBeGreaterThan(confidences[i - 1]!);
    }
    expect(confidences[4]!).toBeLessThanOrEqual(1);
  });

  it('passive observations move mastery at half weight and count as evidence', () => {
    const twin = makeTwin();
    twin.observeDecision(decision(true, [CONCEPT.GridStability]));
    const activeGain = (twin.masteryOf(CONCEPT.GridStability) as number) - 0.5;

    const twin2 = makeTwin();
    twin2.observePassive(CONCEPT.GridStability, true);
    const passiveGain = (twin2.masteryOf(CONCEPT.GridStability) as number) - 0.5;

    expect(passiveGain).toBeGreaterThan(0);
    expect(passiveGain).toBeLessThan(activeGain);
    expect(
      twin2.state().concepts.find((c) => c.concept === CONCEPT.GridStability)?.evidenceCount,
    ).toBe(1);
  });

  it('tracks blackouts and zones saved as run outcomes', () => {
    const twin = makeTwin();
    twin.noteBlackout();
    twin.noteZoneSaved();
    twin.noteZoneSaved();
    expect(twin.state().blackouts_caused).toBe(1);
    expect(twin.state().zones_saved).toBe(2);
  });

  it('equity awareness mirrors the equity concept mastery', () => {
    const twin = makeTwin();
    twin.observePassive(CONCEPT.Equity, true);
    expect(twin.state().equity_awareness_score as number).toBeGreaterThan(0.5);
  });
});
