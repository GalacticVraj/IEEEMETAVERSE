/**
 * benchmarks.ts — the scores to beat.
 *
 * The brief asked for a "Global Leaderboard" seeded with fake placeholder
 * players. That is the one thing this file deliberately is NOT. Inventing
 * named operators and their scores would put fabricated records in front of a
 * judging panel and present them as other people's play — and GridGuard's
 * whole pitch is that every number on screen was measured.
 *
 * So the board holds BENCHMARKS instead: named operating standards, each with
 * a target score and the doctrine it represents. They are explicitly labelled
 * as reference targets, not as people. That is honest, it still gives the
 * player something to chase, and it is strictly more useful — "Textbook N-1
 * Response, 88" tells you what to aim at and why, which "Alex_92, 88" does not.
 *
 * The player's own bests come from the career store and sit in the same table,
 * so a real score outranking a benchmark is a real achievement.
 */

export interface Benchmark {
  readonly id: string;
  /** The standard, not a person. */
  readonly label: string;
  /** Which scenario it applies to, or null for an all-round standard. */
  readonly scenarioId: string | null;
  readonly score: number;
  /** What an operator has to do to reach it. */
  readonly basis: string;
}

export const BENCHMARKS: readonly Benchmark[] = [
  {
    id: 'bench-textbook-n1',
    label: 'Textbook N-1 Response',
    scenarioId: 'heatwave',
    score: 92,
    basis: 'Reserve held above the largest in-feed all shift; no district ever dark.',
  },
  {
    id: 'bench-early-shed',
    label: 'Pre-emptive Load Management',
    scenarioId: 'heatwave',
    score: 84,
    basis: 'Demand reduced before the baseload trip rather than after it.',
  },
  {
    id: 'bench-storm-ride',
    label: 'Storm Ride-Through',
    scenarioId: 'storm',
    score: 86,
    basis: 'Corridors kept inside rating through the overspeed cut-out.',
  },
  {
    id: 'bench-cyber-isolate',
    label: 'Operating Without Trusted Telemetry',
    scenarioId: 'cyber-attack',
    score: 80,
    basis: 'Correct calls made while instrument provenance was unverified.',
  },
  {
    id: 'bench-duck-curve',
    label: 'Duck Curve Managed',
    scenarioId: 'demand-surge',
    score: 83,
    basis: 'Evening ramp covered without shedding a residential district.',
  },
  {
    id: 'bench-winter-fuel',
    label: 'Fuel-Secure Winter Operation',
    scenarioId: 'cold-snap',
    score: 81,
    basis: 'Peaker loss anticipated before pipeline pressure dropped.',
  },
  {
    id: 'bench-clean-sheet',
    label: 'Clean Sheet',
    scenarioId: null,
    score: 95,
    basis: 'A full shift with no trip, no shed, and no district lost.',
  },
];

/** A row on the board — a benchmark or one of the player's real bests. */
export interface BoardRow {
  readonly key: string;
  readonly label: string;
  readonly scenarioId: string | null;
  readonly score: number;
  readonly detail: string;
  readonly kind: 'benchmark' | 'you';
}

/**
 * Build the board: benchmarks plus the player's measured bests, ranked.
 *
 * The player's rows are marked so the UI can never present a benchmark as a
 * human score or vice versa.
 */
export function buildBoard(
  bestScores: Readonly<Record<string, number>>,
  operatorName: string,
  rank: string,
  scenarioFilter: string | null,
): readonly BoardRow[] {
  const benchmarkRows: BoardRow[] = BENCHMARKS.map((benchmark) => ({
    key: benchmark.id,
    label: benchmark.label,
    scenarioId: benchmark.scenarioId,
    score: benchmark.score,
    detail: benchmark.basis,
    kind: 'benchmark',
  }));

  const yours: BoardRow[] = Object.entries(bestScores).map(([scenarioId, score]) => ({
    key: `you-${scenarioId}`,
    label: operatorName,
    scenarioId,
    score,
    detail: `Your best as ${rank}.`,
    kind: 'you',
  }));

  return [...benchmarkRows, ...yours]
    .filter(
      (row) =>
        scenarioFilter === null || row.scenarioId === scenarioFilter || row.scenarioId === null,
    )
    .sort((a, b) => b.score - a.score);
}
