/**
 * career-store.ts — who the operator is, across shifts.
 *
 * The one store here that is genuinely PERSISTENT and genuinely UI-owned. It
 * holds no simulation state: it is a record of runs that already finished,
 * written once at the after-action screen from figures the engine measured.
 * Nothing in it can feed back into a live run.
 *
 * Rank is DERIVED, never stored. Storing it would let it drift out of step
 * with the score that earns it — the classic denormalisation bug — and there
 * is no cost to computing a comparison against four thresholds.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type OperatorRank =
  'Apprentice' | 'Operator' | 'Senior Operator' | 'Shift Lead' | 'Chief Engineer';

/** Lower bound of each rank, in cumulative career points. */
export const RANK_THRESHOLDS: readonly { readonly rank: OperatorRank; readonly from: number }[] = [
  { rank: 'Chief Engineer', from: 2000 },
  { rank: 'Shift Lead', from: 1000 },
  { rank: 'Senior Operator', from: 500 },
  { rank: 'Operator', from: 200 },
  { rank: 'Apprentice', from: 0 },
];

export function rankOf(totalScore: number): OperatorRank {
  return RANK_THRESHOLDS.find((entry) => totalScore >= entry.from)?.rank ?? 'Apprentice';
}

/** Points still needed for the next rank, and what it is. Null at the top. */
export function nextRank(totalScore: number): { rank: OperatorRank; remaining: number } | null {
  const ordered = [...RANK_THRESHOLDS].reverse(); // ascending
  const next = ordered.find((entry) => entry.from > totalScore);
  return next === undefined ? null : { rank: next.rank, remaining: next.from - totalScore };
}

/**
 * A badge is a claim about something that measurably happened. Each carries
 * the condition it is awarded for so the UI can explain it rather than just
 * showing a token — and so nobody has to guess what earned it.
 */
export interface BadgeDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export const BADGES: readonly BadgeDefinition[] = [
  {
    id: 'first-shift',
    label: 'First Shift',
    description: 'Completed a full operator shift.',
  },
  {
    id: 'blackout-prevented',
    label: 'Lights Stayed On',
    description: 'Finished a shift with no district ever losing power.',
  },
  {
    id: 'steady-hand',
    label: 'Steady Hand',
    description: 'Held frequency inside 59.8–60.2 Hz for an entire shift.',
  },
  {
    id: 'cascade-contained',
    label: 'Cascade Contained',
    description: 'Survived a protection trip without losing a single district.',
  },
  {
    id: 'renewables-carried',
    label: 'Renewables Carried It',
    description: 'Averaged 30 % or more renewable generation across a shift.',
  },
  {
    id: 'every-crisis',
    label: 'Every Crisis',
    description: 'Completed every scenario Meridian Bay can throw at you.',
  },
];

/** Facts about a finished run. Every field is measured, none estimated. */
export interface RunRecord {
  readonly scenarioId: string;
  /** 0–100 overall from `scoreRun`. */
  readonly score: number;
  readonly zonesEverDark: number;
  readonly worstFrequencyDeviationHz: number;
  readonly lineTrips: number;
  readonly renewableShareAvg: number;
  /** How many scenarios exist, for the completionist badge. */
  readonly totalScenarioCount: number;
}

/**
 * Cumulative evidence for one concept, across every shift ever played.
 *
 * Stored as a weighted SUM plus a count rather than as a mastery percentage,
 * so runs can be combined correctly. Averaging percentages would let a single
 * lucky run with one observation outweigh a careful run with twenty.
 */
export interface ConceptEvidence {
  /** Σ (mastery × evidenceCount) over all runs. */
  readonly weighted: number;
  /** Σ evidenceCount over all runs. */
  readonly evidence: number;
}

/** One concept's mastery as the dashboard shows it, 0..1. */
export function masteryOf(
  conceptEvidence: Readonly<Record<string, ConceptEvidence>>,
  concept: string,
): number {
  const entry = conceptEvidence[concept];
  if (entry === undefined || entry.evidence <= 0) return 0;
  return Math.min(1, Math.max(0, entry.weighted / entry.evidence));
}

/** A concept observation from one finished run, as the LearnerTwin reports it. */
export interface ConceptObservation {
  readonly concept: string;
  readonly mastery: number;
  readonly evidenceCount: number;
}

export interface CareerState {
  readonly operatorName: string;
  readonly totalRuns: number;
  readonly totalScore: number;
  readonly completedScenarios: readonly string[];
  readonly bestScores: Readonly<Record<string, number>>;
  readonly badges: readonly string[];
  /**
   * Concept mastery accumulated across sessions.
   *
   * The LearnerTwin is in-memory and resets on refresh, so mastery bars built
   * straight from it would restart at zero every visit — which is precisely
   * the opposite of what a "grows across multiple runs" dashboard claims. This
   * is the durable copy, banked at the after-action screen.
   */
  readonly conceptEvidence: Readonly<Record<string, ConceptEvidence>>;
  readonly setOperatorName: (name: string) => void;
  /** Record a finished run. Idempotent per call site — see AfterActionScreen. */
  readonly recordRun: (record: RunRecord) => void;
  /** Bank this run's concept observations into the cumulative record. */
  readonly recordConcepts: (observations: readonly ConceptObservation[]) => void;
  readonly reset: () => void;
}

/** Which badges this run earned, from measured facts only. */
export function badgesEarned(
  record: RunRecord,
  completedAfter: readonly string[],
): readonly string[] {
  const earned: string[] = ['first-shift'];

  if (record.zonesEverDark === 0) earned.push('blackout-prevented');
  if (record.worstFrequencyDeviationHz < 0.2) earned.push('steady-hand');
  if (record.lineTrips > 0 && record.zonesEverDark === 0) earned.push('cascade-contained');
  if (record.renewableShareAvg >= 0.3) earned.push('renewables-carried');
  if (record.totalScenarioCount > 0 && completedAfter.length >= record.totalScenarioCount) {
    earned.push('every-crisis');
  }

  return earned;
}

/**
 * `localStorage` where there is one, a silent no-op where there is not.
 *
 * Without this, every test that touches the store logs a zustand warning about
 * unavailable storage — noise that trains you to ignore the console. It also
 * means a browser with storage disabled degrades to a career that simply does
 * not persist, rather than throwing on first write.
 */
const careerStorage = createJSONStorage(() => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    const empty: Storage = {
      length: 0,
      clear: () => undefined,
      getItem: () => null,
      key: () => null,
      removeItem: () => undefined,
      setItem: () => undefined,
    };
    return empty;
  }
  return window.localStorage;
});

const INITIAL = {
  operatorName: 'Operator',
  totalRuns: 0,
  totalScore: 0,
  completedScenarios: [] as readonly string[],
  bestScores: {} as Readonly<Record<string, number>>,
  badges: [] as readonly string[],
  conceptEvidence: {} as Readonly<Record<string, ConceptEvidence>>,
};

export const useCareerStore = create<CareerState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      setOperatorName: (name) => {
        const trimmed = name.trim();
        set({ operatorName: trimmed.length === 0 ? 'Operator' : trimmed.slice(0, 24) });
      },

      recordRun: (record) => {
        const state = get();
        const completed = state.completedScenarios.includes(record.scenarioId)
          ? state.completedScenarios
          : [...state.completedScenarios, record.scenarioId];

        const previousBest = state.bestScores[record.scenarioId] ?? 0;
        const earned = badgesEarned(record, completed);

        set({
          totalRuns: state.totalRuns + 1,
          totalScore: state.totalScore + record.score,
          completedScenarios: completed,
          bestScores: {
            ...state.bestScores,
            [record.scenarioId]: Math.max(previousBest, record.score),
          },
          badges: [...new Set([...state.badges, ...earned])],
        });
      },

      recordConcepts: (observations) => {
        const merged: Record<string, ConceptEvidence> = { ...get().conceptEvidence };
        for (const observation of observations) {
          if (observation.evidenceCount <= 0) continue;
          const previous = merged[observation.concept] ?? { weighted: 0, evidence: 0 };
          merged[observation.concept] = {
            weighted: previous.weighted + observation.mastery * observation.evidenceCount,
            evidence: previous.evidence + observation.evidenceCount,
          };
        }
        set({ conceptEvidence: merged });
      },

      reset: () => {
        set({ ...INITIAL });
      },
    }),
    {
      name: 'gridguard.career.v1',
      storage: careerStorage,
      // Persist only the record; the actions are recreated on load.
      partialize: (state) => ({
        operatorName: state.operatorName,
        totalRuns: state.totalRuns,
        totalScore: state.totalScore,
        completedScenarios: state.completedScenarios,
        bestScores: state.bestScores,
        badges: state.badges,
        conceptEvidence: state.conceptEvidence,
      }),
    },
  ),
);
