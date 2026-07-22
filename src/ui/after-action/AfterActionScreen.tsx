/**
 * AfterActionScreen — the evidence-based after-action review.
 *
 * EVERYTHING here is generated from the completed run: run-stats projection,
 * event log, measured decision records, the Learner Twin, and the
 * deterministic scoring engine. The advisor narrative renders instantly from
 * local evidence; Gemini (when reachable) rewrites the SAME evidence and
 * swaps in seamlessly. Nothing is mocked, nothing is invented.
 */
import { useEffect, useMemo, useState, type ReactElement } from 'react';

import { EVIDENCE_ENGINE, LEARNER_TWIN, scoreRun } from '@learning';
import type { CategoryScore, DecisionEvidence, LearnerTwinState } from '@learning';
import {
  CRISIS_CARDS,
  labelForDecision,
  recoveryTicksOf,
  useAppFlowStore,
  useEventLogStore,
  useRunStatsStore,
} from '@state';

import { useRuntime } from '../../runtime-context';
import { estimateHouseholdsAffected, simClock } from '../console/learning-copy';

import { requestAdvisorNarrative } from '../advisor/advisor-client';
import { buildAdvisorContext, buildDeterministicNarrative } from '../advisor/narrative';

const VERDICT_STYLE: Record<string, { label: string; color: string }> = {
  improved: { label: 'IMPROVED', color: '#217A56' },
  'no-effect': { label: 'NO EFFECT', color: '#9A6B15' },
  worsened: { label: 'WORSENED', color: '#B3261E' },
  pending: { label: 'PENDING', color: '#5F6B76' },
};

const SEVERITY_COLOR: Record<string, string> = {
  info: '#8B97A3',
  caution: '#9A6B15',
  warning: '#B4531F',
  critical: '#B3261E',
  recovery: '#217A56',
};

function scoreTone(score: number): string {
  if (score >= 75) return '#217A56';
  if (score >= 50) return '#9A6B15';
  return '#B3261E';
}

function Panel({ title, children }: { title: string; children: React.ReactNode }): ReactElement {
  return (
    <div className="console-panel" style={{ padding: '12px 16px', minWidth: 0 }}>
      <div className="console-section-title" style={{ marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #E7E9E6' }}>
      <span style={{ fontSize: 12, color: '#5A6774' }}>{label}</span>
      <span className="console-value" style={{ fontSize: 12, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export function AfterActionScreen(): ReactElement {
  const crisisResult = useAppFlowStore((s) => s.crisisResult);
  const selectedCrisis = useAppFlowStore((s) => s.selectedCrisis);
  const replay = useAppFlowStore((s) => s.replay);
  const returnToHero = useAppFlowStore((s) => s.returnToHero);
  const stats = useRunStatsStore();
  const entries = useEventLogStore((s) => s.entries);
  const runtime = useRuntime();

  const [twinState, setTwinState] = useState<LearnerTwinState | null>(null);
  const [records, setRecords] = useState<readonly DecisionEvidence[]>([]);
  const [narrative, setNarrative] = useState<string>('');
  const [narrativeSource, setNarrativeSource] = useState<'deterministic' | 'gemini'>('deterministic');

  const scenarioName =
    CRISIS_CARDS.find((card) => card.id === selectedCrisis)?.label ?? 'Crisis Scenario';
  const outcome = stats.outcome ?? (crisisResult === 'success' ? 'Held' : 'SystemBlackout');

  // One-shot evidence gathering at mount (the run is over; data is frozen).
  useEffect(() => {
    try {
      setTwinState(runtime.container.resolve(LEARNER_TWIN).state());
      setRecords(runtime.container.resolve(EVIDENCE_ENGINE).records());
    } catch {
      // Containers always resolve in the real app; tests may stub.
    }
  }, [runtime]);

  const scores: readonly CategoryScore[] = useMemo(() => {
    if (twinState === null) return [];
    return scoreRun({
      outcome,
      stats: { ...stats, recoveryTicks: recoveryTicksOf(stats) },
      decisions: records,
      twin: twinState,
    });
  }, [outcome, stats, records, twinState]);

  // Deterministic narrative first; Gemini rewrite swaps in when it responds.
  useEffect(() => {
    if (twinState === null || scores.length === 0) return;
    const context = buildAdvisorContext({
      outcome,
      scenario: scenarioName,
      stats,
      entries,
      decisions: records,
      twin: twinState,
      scores,
    });
    setNarrative(buildDeterministicNarrative(context));
    let cancelled = false;
    void requestAdvisorNarrative(context).then((text) => {
      if (!cancelled && text !== null) {
        setNarrative(text);
        setNarrativeSource('gemini');
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gather once when evidence is ready
  }, [twinState, scores.length]);

  const held = outcome === 'Held';
  const overall = scores.find((score) => score.id === 'overall');
  const recoveryTicks = recoveryTicksOf(stats);
  const importantEntries = entries.filter((entry) => entry.severity !== 'info').slice(-14);
  const unservedMwS = Math.round(stats.unservedEnergyMwTicks / 10);

  return (
    <div className="absolute inset-0 z-40 pointer-events-auto" style={{ background: 'rgba(28, 37, 48, 0.55)', overflowY: 'auto' }}>
      <div style={{ maxWidth: 1180, margin: '28px auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* ── Header ── */}
        <div className="console-panel" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="console-section-title">After-Action Review · {scenarioName}</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: held ? '#217A56' : '#B3261E', marginTop: 2 }}>
              {held ? 'Grid Held' : outcome === 'PartialBlackout' ? 'Partial Blackout' : 'System Blackout'}
            </div>
            <div style={{ fontSize: 12, color: '#5A6774' }}>
              Shift length {simClock(stats.latestTick)} · {records.length} measured intervention(s)
            </div>
          </div>
          {overall !== undefined && (
            <div style={{ textAlign: 'right' }}>
              <div className="console-value" style={{ fontSize: 40, fontWeight: 600, color: scoreTone(overall.score) }}>
                {overall.score}
              </div>
              <div className="console-section-title">Overall Mission Rating</div>
            </div>
          )}
        </div>

        {/* ── Advisor narrative ── */}
        <Panel title={narrativeSource === 'gemini' ? 'Mission Debrief · AI mentor (Gemini, evidence-grounded)' : 'Mission Debrief · deterministic analysis'}>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: '#1C2530' }}>
            {narrative.length > 0 ? narrative : 'Assembling the evidence from your run…'}
          </p>
        </Panel>

        {/* ── Scores ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          {scores
            .filter((score) => score.id !== 'overall')
            .map((score) => (
              <div key={score.id} className="console-panel" style={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1C2530' }}>{score.label}</span>
                  <span className="console-value" style={{ fontSize: 20, fontWeight: 600, color: scoreTone(score.score) }}>
                    {score.score}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#5A6774', marginTop: 4, lineHeight: 1.45 }}>{score.reason}</div>
              </div>
            ))}
        </div>

        {/* ── Three-column evidence ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
          {/* Grid performance */}
          <Panel title="Grid Performance">
            <StatRow label="Peak demand" value={`${Math.round(stats.peakDemandMw)} MW`} />
            <StatRow label="Worst supply balance" value={`${Math.round(stats.worstBalanceMw)} MW`} />
            <StatRow label="Peak corridor stress" value={`${Math.round(stats.peakCorridorStress * 100)} %`} />
            <StatRow label="Renewable share (avg)" value={`${Math.round(stats.renewableShareAvg * 100)} %`} />
            <StatRow label="Protection trips" value={String(stats.lineTrips)} />
            <StatRow label="Unserved energy" value={`${unservedMwS} MW·s`} />
            <StatRow
              label="Households affected (est.)"
              value={stats.peakUnservedMw > 0 ? `≈${estimateHouseholdsAffected(stats.peakUnservedMw).toLocaleString()}` : '0'}
            />
            <StatRow
              label="Recovery time"
              value={
                recoveryTicks !== null
                  ? `${Math.round(recoveryTicks / 10)} s`
                  : stats.zonesEverDark.length > 0
                    ? 'not recovered'
                    : 'no outage'
              }
            />
          </Panel>

          {/* Decision analysis */}
          <Panel title="Decision Analysis (measured)">
            {records.length === 0 ? (
              <div style={{ fontSize: 12, color: '#8B97A3' }}>
                No interventions this run — the grid ran unmanaged.
              </div>
            ) : (
              records.map((record) => {
                const verdict = VERDICT_STYLE[record.verdict] ?? VERDICT_STYLE['pending']!;
                return (
                  <div key={`${record.decisionId}-${record.tick}`} style={{ padding: '6px 0', borderBottom: '1px solid #E7E9E6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{labelForDecision(record.decisionId)}</span>
                      <span className="console-value" style={{ fontSize: 10, fontWeight: 600, color: verdict.color }}>
                        {verdict.label}
                      </span>
                    </div>
                    <div className="console-value" style={{ fontSize: 10.5, color: '#5A6774', marginTop: 2 }}>
                      {simClock(record.tick)} · stress {Math.round(record.pre.maxLoading * 100)} %
                      {record.post !== null ? ` → ${Math.round(record.post.maxLoading * 100)} %` : ''}
                    </div>
                  </div>
                );
              })
            )}
          </Panel>

          {/* Concept mastery */}
          <Panel title="Concept Mastery (evidence-based)">
            {twinState === null || twinState.concepts.length === 0 ? (
              <div style={{ fontSize: 12, color: '#8B97A3' }}>
                No measured evidence yet — interventions build your mastery profile.
              </div>
            ) : (
              twinState.concepts.map((concept) => (
                <div key={concept.concept} style={{ padding: '5px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                    <span style={{ color: '#1C2530' }}>{concept.concept}</span>
                    <span className="console-value" style={{ fontWeight: 600 }}>
                      {Math.round((concept.mastery as number) * 100)} %
                    </span>
                  </div>
                  <div style={{ height: 4, background: '#E7E9E6', borderRadius: 1, marginTop: 3 }}>
                    <div
                      style={{
                        height: 4,
                        width: `${Math.round((concept.mastery as number) * 100)}%`,
                        background: (concept.mastery as number) >= 0.6 ? '#217A56' : '#9A6B15',
                        borderRadius: 1,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 9.5, color: '#8B97A3', marginTop: 2 }}>
                    confidence {Math.round((concept.confidence as number) * 100)} % · {concept.evidenceCount} observation(s)
                  </div>
                </div>
              ))
            )}
          </Panel>
        </div>

        {/* ── Timeline ── */}
        <Panel title="Run Timeline (from the event log)">
          {importantEntries.length === 0 ? (
            <div style={{ fontSize: 12, color: '#8B97A3' }}>No notable events were logged this run.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '2px 18px' }}>
              {importantEntries.map((entry) => (
                <div key={entry.seq} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '2px 0' }}>
                  <span className="console-value" style={{ fontSize: 10.5, color: '#8B97A3', whiteSpace: 'nowrap' }}>
                    {simClock(entry.tick)}
                  </span>
                  <span
                    className="console-value"
                    style={{ fontSize: 11, fontWeight: 600, color: SEVERITY_COLOR[entry.severity] ?? '#1C2530', whiteSpace: 'nowrap' }}
                  >
                    {entry.title}
                  </span>
                  <span style={{ fontSize: 11, color: '#5A6774', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.detail}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* ── Actions ── */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', paddingBottom: 24 }}>
          <button className="console-btn-primary" style={{ padding: '10px 32px', fontSize: 13 }} onClick={replay}>
            Run Another Scenario
          </button>
          <button className="console-btn" style={{ padding: '10px 32px', fontSize: 13 }} onClick={returnToHero}>
            End Session
          </button>
        </div>
      </div>
    </div>
  );
}
