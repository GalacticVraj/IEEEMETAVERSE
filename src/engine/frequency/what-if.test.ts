import { describe, expect, it } from 'vitest';

import type { FrequencyMachine } from './frequency-model';
import { projectAction } from './what-if';

const FLEET: readonly FrequencyMachine[] = [
  { id: 'G-BASE-S', kind: 'Baseload', ratedMw: 400, outputMw: 400, online: true },
  { id: 'G-PEAK-S', kind: 'Peaker', ratedMw: 150, outputMw: 150, online: true },
  { id: 'G-SOLAR', kind: 'Solar', ratedMw: 120, outputMw: 90, online: true },
];

const BASE = {
  machines: FLEET,
  generationMw: 640,
  demandMw: 740,
  frequencyHz: 59.6,
  timestepS: 0.1,
  horizonTicks: 50,
};

describe('projectAction', () => {
  it('reports a smaller deficit when load is removed', () => {
    const doNothing = projectAction({ ...BASE, loadReliefMw: 0 });
    const shed = projectAction({ ...BASE, loadReliefMw: 100 });
    expect(shed.finalFrequencyHz).toBeGreaterThan(doNothing.finalFrequencyHz);
    expect(shed.deltaDemandMw).toBe(-100);
  });

  it('predicts recovery toward nominal when relief closes the gap', () => {
    const shed = projectAction({ ...BASE, loadReliefMw: 100 });
    expect(shed.finalFrequencyHz).toBeGreaterThan(BASE.frequencyHz);
  });

  it('predicts continued decline with no action', () => {
    const doNothing = projectAction({ ...BASE, loadReliefMw: 0 });
    expect(doNothing.finalFrequencyHz).toBeLessThan(BASE.frequencyHz);
  });

  it('flags whether UFLS would fire within the horizon', () => {
    const severe = projectAction({ ...BASE, demandMw: 900, loadReliefMw: 0 });
    expect(severe.uflsWouldFire).toBe(true);
    const relieved = projectAction({ ...BASE, demandMw: 900, loadReliefMw: 300 });
    expect(relieved.uflsWouldFire).toBe(false);
  });

  it('never mutates the caller’s machine list', () => {
    const before = JSON.stringify(FLEET);
    projectAction({ ...BASE, loadReliefMw: 100 });
    expect(JSON.stringify(FLEET)).toBe(before);
  });

  it('is deterministic', () => {
    const input = { ...BASE, loadReliefMw: 60 };
    expect(projectAction(input)).toEqual(projectAction(input));
  });
});
