import { describe, expect, it } from 'vitest';

import { createFrequencyModel } from './frequency-model';
import type { FrequencyMachine } from './frequency-model';

const FLEET: readonly FrequencyMachine[] = [
  { id: 'G-BASE-S', kind: 'Baseload', ratedMw: 400, outputMw: 400, online: true },
  { id: 'G-PEAK-S', kind: 'Peaker', ratedMw: 150, outputMw: 120, online: true },
  { id: 'G-PEAK-IN', kind: 'Peaker', ratedMw: 80, outputMw: 60, online: true },
  { id: 'G-GAS-HB', kind: 'Peaker', ratedMw: 60, outputMw: 50, online: true },
  { id: 'G-IMPORT', kind: 'Import', ratedMw: 200, outputMw: 200, online: true },
  { id: 'G-SOLAR', kind: 'Solar', ratedMw: 120, outputMw: 90, online: true },
  { id: 'G-WIND', kind: 'Wind', ratedMw: 90, outputMw: 40, online: true },
  { id: 'G-BATT-DT', kind: 'Storage', ratedMw: 50, outputMw: 20, online: true },
];

const balanced = () => ({
  machines: FLEET,
  generationMw: 980,
  demandMw: 980,
  timestepS: 0.1,
});

describe('FrequencyModel', () => {
  it('starts at nominal with full fleet inertia', () => {
    const model = createFrequencyModel();
    const out = model.step(balanced());
    expect(out.frequencyHz).toBeCloseTo(60, 6);
    expect(out.inertiaMwS).toBe(3760);
    expect(out.uflsStage).toBe(0);
  });

  it('falls continuously under a sustained deficit', () => {
    const model = createFrequencyModel();
    const deficit = { ...balanced(), generationMw: 880 };
    const first = model.step(deficit);
    const second = model.step(deficit);
    expect(first.frequencyHz).toBeLessThan(60);
    expect(second.frequencyHz).toBeLessThan(first.frequencyHz);
    expect(second.rocofHzPerS).toBeLessThan(0);
  });

  it('loses inertia when a synchronous machine goes offline', () => {
    const model = createFrequencyModel();
    const withImport = model.step(balanced());
    const withoutImport = model.step({
      ...balanced(),
      machines: FLEET.map((m) => (m.id === 'G-IMPORT' ? { ...m, online: false, outputMw: 0 } : m)),
      generationMw: 780,
    });
    expect(withImport.inertiaMwS).toBe(3760);
    expect(withoutImport.inertiaMwS).toBe(3160);
  });

  it('fires UFLS once frequency reaches the first threshold', () => {
    const model = createFrequencyModel();
    const severe = { ...balanced(), generationMw: 700 };
    let out = model.step(severe);
    for (let i = 0; i < 200 && out.uflsStage === 0; i += 1) {
      out = model.step(severe);
    }
    expect(out.uflsStage).toBeGreaterThanOrEqual(1);
    expect(out.uflsShedFraction).toBeGreaterThan(0);
  });

  it('reports an N-1 security verdict each step', () => {
    const model = createFrequencyModel();
    const out = model.step(balanced());
    expect(['Secure', 'AtRisk', 'Insecure']).toContain(out.security);
    expect(out.reserveMw).toBeGreaterThan(0);
  });

  it('is deterministic across two identically driven models', () => {
    const a = createFrequencyModel();
    const b = createFrequencyModel();
    const input = { ...balanced(), generationMw: 900 };
    for (let i = 0; i < 50; i += 1) {
      expect(a.step(input)).toEqual(b.step(input));
    }
  });

  it('round-trips through capture and restore', () => {
    const model = createFrequencyModel();
    const input = { ...balanced(), generationMw: 900 };
    for (let i = 0; i < 20; i += 1) model.step(input);

    const snapshot = model.captureState();
    const expected = model.step(input);

    const restored = createFrequencyModel();
    restored.restoreState(snapshot);
    expect(restored.step(input)).toEqual(expected);
  });

  it('returns to nominal after reset', () => {
    const model = createFrequencyModel();
    for (let i = 0; i < 20; i += 1) model.step({ ...balanced(), generationMw: 800 });
    model.reset();
    expect(model.getState().frequencyHz).toBe(60);
  });
});
