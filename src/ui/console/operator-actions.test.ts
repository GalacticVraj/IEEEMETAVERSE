/**
 * The console tells the operator what a lever buys BEFORE they commit. That
 * number has to come from the same physics that judges them afterwards —
 * anything estimated in the UI eventually disagrees with the simulation, and
 * a teaching tool that lies about consequence stops teaching.
 *
 * These tests pin the catalog's relief figures against the real what-if API.
 */
import { projectAction } from '@engine/frequency';
import type { FrequencyMachine } from '@engine/frequency';
import { MERIDIAN_BAY_TOPOLOGY } from '@engine/topology/meridian-bay';
import { describe, expect, it } from 'vitest';

import { OPERATOR_ACTIONS } from './operator-actions';

/** An evening operating point in trouble: baseload gone, deficit open. */
const STRESSED: readonly FrequencyMachine[] = MERIDIAN_BAY_TOPOLOGY.generators.map((g) => {
  const id = g.id as string;
  const dispatch: Record<string, number> = {
    'G-BASE-S': 0, // tripped — the T+1:00 beat
    'G-PEAK-S': 220,
    'G-PEAK-IN': 80,
    'G-SOLAR': 10,
    'G-WIND': 40,
    'G-BATT-DT': 50,
    'G-IMPORT': 200,
    'G-GAS-HB': 60,
  };
  return {
    id,
    kind: g.kind as string,
    ratedMw: g.capacity as number,
    outputMw: dispatch[id] ?? 0,
    online: id !== 'G-BASE-S',
  };
});

const generationMw = STRESSED.reduce((s, m) => s + (m.online ? m.outputMw : 0), 0);

const base = {
  machines: STRESSED,
  generationMw,
  demandMw: generationMw + 120, // 120 MW short
  frequencyHz: 59.6,
  timestepS: 0.1,
  horizonTicks: 50,
};

describe('operator action catalog', () => {
  it('gives every lever a relief figure the projection can use', () => {
    expect(OPERATOR_ACTIONS.length).toBeGreaterThan(0);
    for (const action of OPERATOR_ACTIONS) {
      expect(action.reliefMw, action.id).toBeGreaterThan(0);
    }
  });

  it('every lever measurably improves frequency over doing nothing', () => {
    const doNothing = projectAction({ ...base, loadReliefMw: 0 });
    for (const action of OPERATOR_ACTIONS) {
      const withAction = projectAction({ ...base, loadReliefMw: action.reliefMw });
      expect(withAction.finalFrequencyHz, action.id).toBeGreaterThan(doNothing.finalFrequencyHz);
    }
  });

  it('ranks levers by relief — a bigger shed buys more frequency', () => {
    const sorted = [...OPERATOR_ACTIONS].sort((a, b) => a.reliefMw - b.reliefMw);
    const deltas = sorted.map(
      (a) => projectAction({ ...base, loadReliefMw: a.reliefMw }).finalFrequencyHz,
    );
    for (let i = 1; i < deltas.length; i += 1) {
      expect(deltas[i]!, `${sorted[i]!.id} vs ${sorted[i - 1]!.id}`).toBeGreaterThanOrEqual(
        deltas[i - 1]!,
      );
    }
  });

  it('the shed levers match their exact topology arithmetic', () => {
    // These two are not estimates — they are a fixed fraction of named loads,
    // and the engine applies exactly that fraction on commit.
    const loadMw = (id: string): number =>
      (MERIDIAN_BAY_TOPOLOGY.loads.find((l) => (l.id as string) === id)?.nominalDemand ??
        0) as number;

    const industrial = OPERATOR_ACTIONS.find((a) => a.id === 'op-shed-industrial');
    expect(industrial?.reliefMw).toBe(
      Math.round(0.3 * (loadMw('LD-IN-HVY') + loadMw('LD-IN-LGT'))),
    );

    const harbor = OPERATOR_ACTIONS.find((a) => a.id === 'op-shed-harbor');
    expect(harbor?.reliefMw).toBe(Math.round(0.25 * (loadMw('LD-HB-IND') + loadMw('LD-HB-SHIP'))));
  });

  it('the full catalog together can avert automatic shedding here', () => {
    const total = OPERATOR_ACTIONS.reduce((s, a) => s + a.reliefMw, 0);
    expect(projectAction({ ...base, loadReliefMw: 0 }).uflsWouldFire).toBe(true);
    expect(projectAction({ ...base, loadReliefMw: total }).uflsWouldFire).toBe(false);
  });
});
