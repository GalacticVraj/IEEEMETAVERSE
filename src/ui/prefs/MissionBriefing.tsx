/**
 * MissionBriefing — the 30-second onboarding card, shown once per session at
 * scenario selection (after the intro lands). Plain objectives, no lore dump.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';

export function MissionBriefing(): ReactElement | null {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 26,
        maxWidth: 500,
        width: 'calc(100% - 680px)',
        minWidth: 320,
        pointerEvents: 'auto',
      }}
      className="animate-slide-down"
    >
      <div
        className="console-panel"
        style={{ padding: '14px 16px', borderLeft: '4px solid #22637E' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              className="console-section-title"
              style={{ color: '#22637E', fontSize: 11, fontWeight: 700 }}
            >
              YOUR MISSION
            </span>
            <span
              style={{
                fontSize: 10,
                background: 'rgba(34, 99, 126, 0.1)',
                color: '#22637E',
                padding: '1px 6px',
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              QUICK ONBOARDING
            </span>
          </div>
          <button
            className="console-btn"
            style={{ padding: '2px 8px', fontSize: 11, minHeight: 24, borderRadius: 4 }}
            onClick={() => setDismissed(true)}
            aria-label="Dismiss briefing"
          >
            ✕
          </button>
        </div>
        <ol style={{ fontSize: 12, lineHeight: 1.6, color: '#1C2530', paddingLeft: 18, margin: 0 }}>
          <li>Pick a crisis on the left and start your shift — the grid runs on real physics.</li>
          <li>
            Keep all six districts powered. Watch <b>Corridor stress</b>: protection trips lines at
            100&nbsp;%.
          </li>
          <li>
            Act through <b>Operator Actions</b> — every choice is measured, and the mentor tells you
            what actually worked.
          </li>
        </ol>
      </div>
    </div>
  );
}
