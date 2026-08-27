import { describe, expect, it } from 'vitest';

import { BENCHMARKS, buildBoard } from './benchmarks';

describe('BENCHMARKS', () => {
  it('names operating standards, never people', () => {
    // The board must never present a fabricated human score to a judging
    // panel. Every entry has to read as a standard with a stated basis.
    for (const benchmark of BENCHMARKS) {
      expect(benchmark.basis.length).toBeGreaterThan(10);
      // No handle-shaped names: "Alex_92", "gridmaster99", etc.
      expect(benchmark.label).not.toMatch(/[_\d]{2,}/);
    }
  });

  it('has unique ids', () => {
    const ids = BENCHMARKS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('buildBoard', () => {
  const bests = { heatwave: 88, storm: 40 };

  it('marks the player rows distinctly from benchmarks', () => {
    const rows = buildBoard(bests, 'V. Shah', 'Operator', null);
    const mine = rows.filter((r) => r.kind === 'you');
    expect(mine).toHaveLength(2);
    for (const row of mine) expect(row.label).toBe('V. Shah');
  });

  it('ranks by score, so beating a benchmark actually shows', () => {
    const rows = buildBoard({ heatwave: 99 }, 'V. Shah', 'Shift Lead', 'heatwave');
    expect(rows[0]?.kind).toBe('you');
    expect(rows[0]?.score).toBe(99);
  });

  it('filters to one scenario but keeps all-round standards', () => {
    const rows = buildBoard(bests, 'V. Shah', 'Operator', 'storm');
    for (const row of rows) {
      expect(row.scenarioId === 'storm' || row.scenarioId === null).toBe(true);
    }
    expect(rows.some((r) => r.scenarioId === null)).toBe(true);
  });

  it('shows only benchmarks before the player has run anything', () => {
    const rows = buildBoard({}, 'V. Shah', 'Apprentice', null);
    expect(rows.every((r) => r.kind === 'benchmark')).toBe(true);
  });
});
