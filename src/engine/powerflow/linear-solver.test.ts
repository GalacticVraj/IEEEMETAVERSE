import { describe, expect, it } from 'vitest';

import { solveLinearSystem } from './linear-solver';

describe('solveLinearSystem', () => {
  it('solves a 2x2 system', () => {
    const result = solveLinearSystem(
      [
        [2, 1],
        [1, 3],
      ],
      [3, 5],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.x[0]).toBeCloseTo(0.8, 9);
    expect(result.x[1]).toBeCloseTo(1.4, 9);
  });

  it('solves the identity system to b', () => {
    const result = solveLinearSystem(
      [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      [4, -2, 7],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.x).toEqual([4, -2, 7]);
  });

  it('requires partial pivoting (zero leading pivot)', () => {
    const result = solveLinearSystem(
      [
        [0, 1],
        [1, 0],
      ],
      [2, 3],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.x[0]).toBeCloseTo(3, 9);
    expect(result.x[1]).toBeCloseTo(2, 9);
  });

  it('detects a singular matrix', () => {
    const result = solveLinearSystem(
      [
        [1, 2],
        [2, 4],
      ],
      [1, 2],
    );
    expect(result.ok).toBe(false);
  });

  it('is deterministic', () => {
    const a = [
      [4, 1, 2],
      [1, 5, 1],
      [2, 1, 3],
    ];
    const b = [7, 7, 6];
    expect(solveLinearSystem(a, b)).toEqual(solveLinearSystem(a, b));
  });

  it('handles the empty system', () => {
    const result = solveLinearSystem([], []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.x).toEqual([]);
  });
});
