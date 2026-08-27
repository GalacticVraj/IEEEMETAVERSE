/**
 * ScenarioPanel — crisis selection. Cards mirror REAL registered scenarios;
 * starting one starts the actual crisis session (kernel ticking + scenario
 * scripting), then flips the app flow to ActiveCrisis.
 *
 * Laid out for the SMALLEST supported viewport, not the largest. When the
 * picker went from three scenarios to six it grew to 929px inside a 148px
 * scroller at 1366×768 — putting "Start Scenario" 791px below an invisible
 * fold, so the player could not begin a run at all. Two rules keep it honest:
 *
 *   1. Only the SELECTED card shows its description. Six paragraphs nobody has
 *      chosen between yet is not information, it is a wall.
 *   2. The start button lives OUTSIDE the scrolling list, so it is reachable
 *      no matter how many scenarios exist.
 */
import { CRISIS_CARDS, useAppFlowStore, useEventLogStore } from '@state';
import { useState } from 'react';
import type { ReactElement } from 'react';

import { useRuntime } from '../../runtime-context';
import { Tooltip } from '../common/Tooltip';

const DIFFICULTY_COLOR: Record<string, string> = {
  Warning: '#9A6B15',
  Critical: '#B3261E',
};

/** Cap on the card list. Beyond this it scrolls; the button never moves. */
const LIST_MAX_HEIGHT = 300;

export function ScenarioPanel(): ReactElement {
  const runtime = useRuntime();
  const selectCrisis = useAppFlowStore((s) => s.selectCrisis);
  const clearLog = useEventLogStore((s) => s.clear);
  const [selected, setSelected] = useState<string | null>(CRISIS_CARDS[0]?.id ?? null);

  const start = (): void => {
    if (selected === null) return;
    clearLog();
    runtime.session.start(selected);
    selectCrisis(selected);
  };

  return (
    <div
      className="console-panel animate-slide-in-left"
      style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="console-section-title">Select Scenario</span>
        <span style={{ fontSize: 9.5, color: '#8B97A3' }}>{CRISIS_CARDS.length} available</span>
      </div>

      <div
        className="console-rail-scroll"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          maxHeight: LIST_MAX_HEIGHT,
          overflowY: 'auto',
          overflowAnchor: 'none',
        }}
      >
        {CRISIS_CARDS.map((card) => {
          const isSelected = card.id === selected;
          return (
            <button
              key={card.id}
              data-scenario={card.id}
              onClick={() => {
                setSelected(card.id);
              }}
              aria-pressed={isSelected}
              style={{
                width: '100%',
                textAlign: 'left',
                background: isSelected ? 'rgba(34, 99, 126, 0.06)' : '#FFFFFF',
                border: `1.5px solid ${isSelected ? '#22637E' : '#D3D7D2'}`,
                borderRadius: 6,
                padding: '7px 10px',
                cursor: 'pointer',
                transition: 'border-color 150ms ease, background 150ms ease',
                font: 'inherit',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#1C2530',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {card.label}
                </span>
                <span
                  className="console-value"
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    color: DIFFICULTY_COLOR[card.difficulty] ?? '#5A6774',
                    letterSpacing: '0.04em',
                    flexShrink: 0,
                  }}
                >
                  {card.difficulty.toUpperCase()}
                </span>
              </div>

              {/* Only the chosen scenario explains itself. */}
              {isSelected && (
                <div style={{ fontSize: 11, color: '#5A6774', marginTop: 4, lineHeight: 1.45 }}>
                  {card.description}
                </div>
              )}
              {isSelected && card.recommended === true && (
                <div
                  className="console-value"
                  style={{ fontSize: 9.5, color: '#22637E', marginTop: 5, fontWeight: 700 }}
                >
                  RECOMMENDED FIRST RUN
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Tooltip
        title="Start Mission Run"
        content="Launches real-time grid physics simulation, enables operator levers, and begins score measurement."
        position="top"
      >
        <button
          className="console-btn-primary"
          style={{ width: '100%', minHeight: 34 }}
          onClick={start}
          disabled={selected === null}
        >
          Start Scenario ▸
        </button>
      </Tooltip>
    </div>
  );
}
