/**
 * Dense linear-system solver via Gaussian elimination with partial pivoting.
 * Pure and deterministic: the same matrix and vector always produce the same
 * solution, and a (near-)singular matrix is detected rather than silently
 * producing garbage. Used to solve the reduced DC system Bθ = P per island.
 *
 * Dense O(n³) — correct and stable for the per-island systems here. A sparse
 * factorization is the documented Phase-5+ optimization for very large islands.
 */

export type LinearSolveResult =
  { readonly ok: true; readonly x: number[] } | { readonly ok: false; readonly reason: string };

const SINGULAR_EPSILON = 1e-10;

const at = (matrix: number[][], row: number, col: number): number =>
  (matrix[row] as number[])[col] as number;

const put = (matrix: number[][], row: number, col: number, value: number): void => {
  (matrix[row] as number[])[col] = value;
};

export function solveLinearSystem(
  matrix: readonly (readonly number[])[],
  vector: readonly number[],
): LinearSolveResult {
  const n = matrix.length;
  if (n === 0) return { ok: true, x: [] };

  const a: number[][] = matrix.map((row) => [...row]);
  const b: number[] = [...vector];

  for (let col = 0; col < n; col += 1) {
    // Partial pivot: pick the row with the largest magnitude in this column.
    let pivotRow = col;
    let maxAbs = Math.abs(at(a, col, col));
    for (let row = col + 1; row < n; row += 1) {
      const magnitude = Math.abs(at(a, row, col));
      if (magnitude > maxAbs) {
        maxAbs = magnitude;
        pivotRow = row;
      }
    }
    if (maxAbs < SINGULAR_EPSILON) {
      return { ok: false, reason: `singular matrix at column ${col}` };
    }
    if (pivotRow !== col) {
      const tmpRow = a[col] as number[];
      a[col] = a[pivotRow] as number[];
      a[pivotRow] = tmpRow;
      const tmpB = b[col] as number;
      b[col] = b[pivotRow] as number;
      b[pivotRow] = tmpB;
    }

    const pivot = at(a, col, col);
    for (let row = col + 1; row < n; row += 1) {
      const factor = at(a, row, col) / pivot;
      if (factor === 0) continue;
      for (let c = col; c < n; c += 1) {
        put(a, row, c, at(a, row, c) - factor * at(a, col, c));
      }
      b[row] = (b[row] as number) - factor * (b[col] as number);
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = b[row] as number;
    for (let col = row + 1; col < n; col += 1) {
      sum -= at(a, row, col) * (x[col] as number);
    }
    x[row] = sum / at(a, row, row);
  }
  return { ok: true, x };
}
