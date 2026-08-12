import { describe, expect, it } from 'vitest';

import { assessReserve } from './reserve';
import type { ReserveUnit } from './reserve';

const HEALTHY: readonly ReserveUnit[] = [
  { id: 'G-BASE-S', kind: 'Baseload', ratedMw: 400, outputMw: 400, online: true },
  { id: 'G-PEAK-S', kind: 'Peaker', ratedMw: 150, outputMw: 60, online: true },
  { id: 'G-PEAK-IN', kind: 'Peaker', ratedMw: 80, outputMw: 30, online: true },
  { id: 'G-IMPORT', kind: 'Import', ratedMw: 200, outputMw: 150, online: true },
  { id: 'G-SOLAR', kind: 'Solar', ratedMw: 120, outputMw: 90, online: true },
];

describe('assessReserve', () => {
  it('reports headroom on online units', () => {
    const result = assessReserve(HEALTHY, 730, 3760);
    // (150-60) + (80-30) + (200-150) + (120-90) = 90+50+50+30 = 220
    expect(result.reserveMw).toBe(220);
  });

  it('identifies the largest single in-feed', () => {
    const result = assessReserve(HEALTHY, 730, 3760);
    expect(result.largestInfeedMw).toBe(400);
    expect(result.largestInfeedId).toBe('G-BASE-S');
  });

  it('is Secure when reserve covers the largest in-feed', () => {
    const plenty: readonly ReserveUnit[] = [
      { id: 'A', kind: 'Peaker', ratedMw: 300, outputMw: 100, online: true },
      { id: 'B', kind: 'Peaker', ratedMw: 300, outputMw: 100, online: true },
    ];
    // largest in-feed 100 MW; reserve 400 MW
    expect(assessReserve(plenty, 200, 3760).verdict).toBe('Secure');
  });

  it('is Insecure when reserve cannot cover the largest in-feed', () => {
    const result = assessReserve(HEALTHY, 730, 3760);
    // reserve 220 < largest in-feed 400
    expect(result.verdict).toBe('Insecure');
  });

  it('excludes offline units from reserve', () => {
    const tripped = HEALTHY.map((u) =>
      u.id === 'G-IMPORT' ? { ...u, online: false, outputMw: 0 } : u,
    );
    const result = assessReserve(tripped, 730, 3160);
    // 90 + 50 + 30 = 170
    expect(result.reserveMw).toBe(170);
  });

  it('never reports negative headroom for an over-dispatched unit', () => {
    const over: readonly ReserveUnit[] = [
      { id: 'A', kind: 'Peaker', ratedMw: 100, outputMw: 120, online: true },
    ];
    expect(assessReserve(over, 120, 3760).reserveMw).toBe(0);
  });

  it('projects the RoCoF that losing the largest in-feed would cause', () => {
    const result = assessReserve(HEALTHY, 730, 3160);
    // 60 * 400 / (2 * 3160) = 3.797...
    expect(result.projectedRocofHzPerS).toBeCloseTo(3.7975, 3);
  });
});
