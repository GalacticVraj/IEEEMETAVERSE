/**
 * ScenarioPanel — crisis selection. Cards mirror REAL registered scenarios;
 * starting one starts the actual crisis session (kernel ticking + scenario
 * scripting), then flips the app flow to ActiveCrisis.
 */
import { CRISIS_CARDS, useAppFlowStore, useEventLogStore } from '@state';
import { useState } from 'react';
import type { ReactElement } from 'react';

import { useRuntime } from '../../runtime-context';
import { Tooltip } from '../common/Tooltip';
import { PanelHeader } from './PanelHeader';

function CompassIcon(): ReactElement {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

const DIFFICULTY_COLOR: Record<string, string> = {
  Warning: '#9A6B15',
  Critical: '#B3261E',
};

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
      style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <PanelHeader
        title="SELECT SCENARIO"
        subtitle="Mission summary and crisis selection"
        icon={<CompassIcon />}
      />

      {/* Next expected action banner */}
      <div
        style={{
          background: 'rgba(34, 99, 126, 0.08)',
          borderLeft: '3px solid #22637E',
          padding: '6px 10px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600,
          color: '#22637E',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>👈</span>
        <span>STEP 1: Select a scenario to launch shift</span>
      </div>

      {CRISIS_CARDS.map((card) => {
        const isSelected = card.id === selected;
        return (
          <Tooltip
            key={card.id}
            title={`Select ${card.label}`}
            content={`Sets up ${card.label} (${card.difficulty} difficulty). Click to select, then click Start Scenario to begin.`}
            position="right"
          >
            <button
              data-scenario={card.id}
              onClick={() => setSelected(card.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: isSelected ? 'rgba(34, 99, 126, 0.06)' : '#FFFFFF',
                border: `1.5px solid ${isSelected ? '#22637E' : '#D3D7D2'}`,
                borderRadius: 6,
                padding: '10px 12px',
                cursor: 'pointer',
                transition: 'all 150ms ease',
                boxShadow: isSelected
                  ? '0 2px 8px rgba(34, 99, 126, 0.12)'
                  : '0 1px 2px rgba(28, 37, 48, 0.04)',
              }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1C2530' }}>
                  {card.label}
                </span>
                <span
                  className="console-value"
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: DIFFICULTY_COLOR[card.difficulty] ?? '#5A6774',
                    letterSpacing: '0.04em',
                  }}
                >
                  {card.difficulty.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#5A6774', marginTop: 4, lineHeight: 1.45 }}>
                {card.description}
              </div>
              {card.recommended === true && (
                <div
                  className="console-value"
                  style={{
                    fontSize: 10,
                    color: '#22637E',
                    marginTop: 6,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                  }}
                >
                  ★ RECOMMENDED FIRST RUN
                </div>
              )}
            </button>
          </Tooltip>
        );
      })}

      <Tooltip
        title="Start Mission Run"
        content="Launches real-time grid physics simulation, enables operator levers, and begins score measurement."
        position="top"
      >
        <button
          className="console-btn-primary"
          style={{ width: '100%', marginTop: 2, minHeight: 36 }}
          onClick={start}
          disabled={selected === null}
        >
          Start Scenario ▸
        </button>
      </Tooltip>
    </div>
  );
}
