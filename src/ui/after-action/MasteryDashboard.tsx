/**
 * MasteryDashboard — "Your Grid Mastery", across every shift you have played.
 *
 * Built on the concepts the evidence engine ACTUALLY tracks
 * (`learning/evidence/concepts.ts`), not on a parallel list invented for this
 * screen. The brief named five topics; six of the seven tracked concepts are
 * those five under the catalogue's own names, and inventing a second taxonomy
 * would have produced bars that either stayed empty or were filled with a
 * number nothing measured.
 *
 * Mastery comes from the career store, which persists — the LearnerTwin is
 * in-memory and resets on refresh, so bars drawn straight from it would
 * restart at zero every visit while claiming to show progress across runs.
 *
 * Every bar carries its evidence count. A concept at 80 % on two observations
 * is a very different claim from 80 % on thirty, and hiding that distinction
 * would make the dashboard more confident than the data.
 */
import { ALL_CONCEPTS } from '@learning';
import { masteryOf, useCareerStore } from '@state';
import type { ReactElement } from 'react';

/** What each concept means, in one line the player can act on. */
const CONCEPT_MEANING: Readonly<Record<string, string>> = {
  'Demand Response': 'Cutting demand is the fastest lever an operator owns — and the cheapest.',
  'Renewable Integration':
    'Wind and solar are weather, not schedule. Reserve is what covers the difference.',
  'Grid Stability':
    'Frequency is the whole system agreeing. Deviation means supply and demand disagree.',
  'Cascading Failure':
    'One trip re-routes flow onto its neighbours. The second trip is the one that ends runs.',
  'Transmission Loading':
    'Corridors have thermal limits. Protection acts on them whether you are ready or not.',
  'Grid Resilience': 'N-1: the grid must survive losing its largest single in-feed, right now.',
  'Equity & Critical Infrastructure':
    'Shedding is a choice about who loses power. Hospitals are not a tier you negotiate.',
};

function tone(mastery: number): string {
  if (mastery >= 0.7) return '#217A56';
  if (mastery >= 0.4) return '#9A6B15';
  return '#B4531F';
}

function ConceptRow({
  concept,
  mastery,
  evidence,
}: {
  concept: string;
  mastery: number;
  evidence: number;
}): ReactElement {
  const pct = Math.round(mastery * 100);
  const color = tone(mastery);
  const untouched = evidence === 0;

  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid #E7E9E6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1C2530' }}>{concept}</span>
        <span
          className="console-value"
          style={{ fontSize: 12, fontWeight: 700, color: untouched ? '#8B97A3' : color }}
        >
          {untouched ? 'no evidence yet' : `${String(pct)} %`}
        </span>
      </div>

      <div
        style={{
          height: 6,
          marginTop: 5,
          background: 'rgba(28, 37, 48, 0.07)',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${String(pct)}%`,
            height: '100%',
            background: color,
            borderRadius: 3,
            transition: 'width 500ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>

      <div style={{ fontSize: 10.5, color: '#5A6774', marginTop: 4, lineHeight: 1.4 }}>
        {CONCEPT_MEANING[concept] ?? ''}
      </div>
      <div style={{ fontSize: 9.5, color: '#8B97A3', marginTop: 2 }}>
        {untouched
          ? 'Make a decision that exercises this and it starts being measured.'
          : `${String(Math.round(evidence))} measured observation(s) across your shifts.`}
      </div>
    </div>
  );
}

export function MasteryDashboard(): ReactElement {
  const conceptEvidence = useCareerStore((s) => s.conceptEvidence);
  const totalRuns = useCareerStore((s) => s.totalRuns);

  const rows = ALL_CONCEPTS.map((concept) => ({
    concept,
    mastery: masteryOf(conceptEvidence, concept),
    evidence: conceptEvidence[concept]?.evidence ?? 0,
  }));

  const measured = rows.filter((row) => row.evidence > 0);
  const overall =
    measured.length === 0
      ? 0
      : measured.reduce((sum, row) => sum + row.mastery, 0) / measured.length;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 12, color: '#5A6774' }}>
          Across {totalRuns} recorded shift{totalRuns === 1 ? '' : 's'}
        </span>
        <span
          className="console-value"
          style={{ fontSize: 15, fontWeight: 700, color: tone(overall) }}
        >
          {measured.length === 0 ? '—' : `${String(Math.round(overall * 100))} %`}
        </span>
      </div>

      {rows.map((row) => (
        <ConceptRow
          key={row.concept}
          concept={row.concept}
          mastery={row.mastery}
          evidence={row.evidence}
        />
      ))}

      <div style={{ fontSize: 10, color: '#8B97A3', marginTop: 8, lineHeight: 1.45 }}>
        Mastery is inferred from measured outcomes — whether each decision you made actually
        improved the grid — never from time spent or scenarios opened.
      </div>
    </div>
  );
}
