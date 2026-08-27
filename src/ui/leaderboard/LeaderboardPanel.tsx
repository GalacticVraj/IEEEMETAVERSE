/**
 * LeaderboardPanel — the standards, and where you sit against them.
 *
 * Reachable from the hero screen. Reads the career store for the player's real
 * bests and `benchmarks.ts` for the targets; computes nothing else.
 *
 * Styled as a mission-control scoreboard within the daylight palette — dark
 * enough to read as a board, not the neon-on-black the brief sketched, which
 * would be the only surface in the product that looked like that.
 */
import { rankOf, useCareerStore } from '@state';
import { CRISIS_CARDS } from '@state';
import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { buildBoard } from './benchmarks';

const RANK_COLOR = ['#C9A227', '#9BA6AF', '#B08155'] as const;

export function LeaderboardPanel({ onClose }: { onClose: () => void }): ReactElement {
  const bestScores = useCareerStore((s) => s.bestScores);
  const operatorName = useCareerStore((s) => s.operatorName);
  const totalScore = useCareerStore((s) => s.totalScore);
  const [filter, setFilter] = useState<string | null>(null);

  const rank = rankOf(totalScore);
  const rows = useMemo(
    () => buildBoard(bestScores, operatorName, rank, filter),
    [bestScores, operatorName, rank, filter],
  );

  return (
    <div
      className="absolute inset-0 z-40 pointer-events-auto"
      style={{
        background: 'rgba(18, 25, 33, 0.88)',
        backdropFilter: 'blur(7px)',
        WebkitBackdropFilter: 'blur(7px)',
        overflowY: 'auto',
      }}
    >
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px' }}>
        <div
          className="console-panel"
          style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="console-section-title">Operating Standards</div>
              <div style={{ fontSize: 13, color: '#5A6774', marginTop: 3 }}>
                Benchmark targets for Meridian Bay, and your measured best on each scenario.
              </div>
            </div>
            <button className="console-btn" onClick={onClose}>
              Close
            </button>
          </div>

          {/* The honesty note. It is not a disclaimer tucked away — it is the
              first thing that explains what the board IS. */}
          <div
            style={{
              fontSize: 11,
              lineHeight: 1.5,
              color: '#5A6774',
              background: 'rgba(34, 99, 126, 0.06)',
              border: '1px solid rgba(34, 99, 126, 0.25)',
              borderRadius: 4,
              padding: '7px 10px',
            }}
          >
            These are <strong>operating standards</strong>, not other players. GridGuard does not
            invent scores or names — the only human result on this board is yours, and it appears
            once you have actually run the scenario.
          </div>

          {/* Scenario filter */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              className="console-btn"
              style={{ fontSize: 11, padding: '4px 10px', minHeight: 26 }}
              onClick={() => {
                setFilter(null);
              }}
              aria-pressed={filter === null}
            >
              All scenarios
            </button>
            {CRISIS_CARDS.map((card) => (
              <button
                key={card.id}
                className="console-btn"
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  minHeight: 26,
                  borderColor: filter === card.id ? '#22637E' : undefined,
                  color: filter === card.id ? '#22637E' : undefined,
                }}
                onClick={() => {
                  setFilter(card.id);
                }}
                aria-pressed={filter === card.id}
              >
                {card.label}
              </button>
            ))}
          </div>

          {/* Board */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              className="console-section-title"
              style={{
                display: 'grid',
                gridTemplateColumns: '38px 1fr 150px 64px',
                gap: 10,
                paddingBottom: 5,
                borderBottom: '1px solid #D3D7D2',
                fontSize: 9.5,
              }}
            >
              <span>#</span>
              <span>Standard / Operator</span>
              <span>Scenario</span>
              <span style={{ textAlign: 'right' }}>Score</span>
            </div>

            {rows.map((row, index) => {
              const scenarioLabel =
                row.scenarioId === null
                  ? 'Any scenario'
                  : (CRISIS_CARDS.find((c) => c.id === row.scenarioId)?.label ?? row.scenarioId);
              const mine = row.kind === 'you';
              return (
                <div
                  key={row.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '38px 1fr 150px 64px',
                    gap: 10,
                    alignItems: 'baseline',
                    padding: '7px 0',
                    borderBottom: '1px solid #E7E9E6',
                    background: mine ? 'rgba(34, 99, 126, 0.06)' : undefined,
                  }}
                >
                  <span
                    className="console-value"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: RANK_COLOR[index] ?? '#8B97A3',
                    }}
                  >
                    {index + 1}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: mine ? '#22637E' : '#1C2530',
                      }}
                    >
                      {row.label}
                    </span>
                    <span
                      className="console-value"
                      style={{
                        fontSize: 8.5,
                        marginLeft: 7,
                        padding: '1px 5px',
                        borderRadius: 3,
                        letterSpacing: '0.06em',
                        color: mine ? '#22637E' : '#5A6774',
                        border: `1px solid ${mine ? 'rgba(34,99,126,0.4)' : '#E2E6E1'}`,
                      }}
                    >
                      {mine ? 'YOU' : 'BENCHMARK'}
                    </span>
                    <div style={{ fontSize: 10.5, color: '#8B97A3', marginTop: 2 }}>
                      {row.detail}
                    </div>
                  </span>
                  <span style={{ fontSize: 11, color: '#5A6774' }}>{scenarioLabel}</span>
                  <span
                    className="console-value"
                    style={{ fontSize: 15, fontWeight: 700, textAlign: 'right', color: '#1C2530' }}
                  >
                    {row.score}
                  </span>
                </div>
              );
            })}
          </div>

          {Object.keys(bestScores).length === 0 && (
            <div style={{ fontSize: 11.5, color: '#8B97A3' }}>
              You have no recorded runs yet. Complete a shift and your best score joins the board.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
