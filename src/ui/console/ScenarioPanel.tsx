/**
 * ScenarioPanel — crisis selection. Cards mirror REAL registered scenarios;
 * starting one starts the actual crisis session (kernel ticking + scenario
 * scripting), then flips the app flow to ActiveCrisis.
 */
import { CRISIS_CARDS, useAppFlowStore, useEventLogStore } from '@state';
import { useState } from 'react';
import type { ReactElement } from 'react';

import { useRuntime } from '../../runtime-context';

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
    <div className="console-panel" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="console-section-title">Select Scenario</div>
      {CRISIS_CARDS.map((card) => {
        const isSelected = card.id === selected;
        return (
          <button
            key={card.id}
            data-scenario={card.id}
            onClick={() => setSelected(card.id)}
            style={{
              textAlign: 'left',
              background: isSelected ? '#F0F4F6' : '#FFFFFF',
              border: `1px solid ${isSelected ? '#22637E' : '#D3D7D2'}`,
              borderRadius: 2,
              padding: '8px 10px',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1C2530' }}>{card.label}</span>
              <span
                className="console-value"
                style={{ fontSize: 10, fontWeight: 600, color: DIFFICULTY_COLOR[card.difficulty] ?? '#5A6774' }}
              >
                {card.difficulty.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#5A6774', marginTop: 3, lineHeight: 1.45 }}>
              {card.description}
            </div>
            {card.recommended === true && (
              <div className="console-value" style={{ fontSize: 10, color: '#22637E', marginTop: 4 }}>
                RECOMMENDED FIRST RUN
              </div>
            )}
          </button>
        );
      })}
      <button className="console-btn-primary" onClick={start} disabled={selected === null}>
        Start Scenario
      </button>
    </div>
  );
}
