import { describe, expect, it } from 'vitest';

import { isSynchronous, systemInertiaMwS } from './inertia';
import type { MachineInertiaInput } from './inertia';

/** Meridian Bay's real fleet, all online. */
const FLEET: readonly MachineInertiaInput[] = [
  { kind: 'Baseload', ratedMw: 400, online: true },
  { kind: 'Peaker', ratedMw: 150, online: true },
  { kind: 'Peaker', ratedMw: 80, online: true },
  { kind: 'Peaker', ratedMw: 60, online: true },
  { kind: 'Import', ratedMw: 200, online: true },
  { kind: 'Solar', ratedMw: 120, online: true },
  { kind: 'Wind', ratedMw: 90, online: true },
  { kind: 'Storage', ratedMw: 50, online: true },
];

describe('systemInertiaMwS', () => {
  it('sums H*S over online synchronous machines only', () => {
    // 400*5 + 150*4 + 80*4 + 60*4 + 200*3 = 2000+600+320+240+600 = 3760
    expect(systemInertiaMwS(FLEET)).toBe(3760);
  });

  it('gives inverter-coupled plant zero inertia', () => {
    const invertersOnly = FLEET.filter((m) => !isSynchronous(m.kind));
    expect(systemInertiaMwS(invertersOnly)).toBe(0);
  });

  it('drops when a synchronous machine trips', () => {
    const withoutImport = FLEET.map((m) => (m.kind === 'Import' ? { ...m, online: false } : m));
    expect(systemInertiaMwS(withoutImport)).toBe(3160);
  });

  it('is zero for an empty fleet', () => {
    expect(systemInertiaMwS([])).toBe(0);
  });

  it('classifies machine kinds', () => {
    expect(isSynchronous('Baseload')).toBe(true);
    expect(isSynchronous('Peaker')).toBe(true);
    expect(isSynchronous('Import')).toBe(true);
    expect(isSynchronous('Solar')).toBe(false);
    expect(isSynchronous('Wind')).toBe(false);
    expect(isSynchronous('Storage')).toBe(false);
  });
});
