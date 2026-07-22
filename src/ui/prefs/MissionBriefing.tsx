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
        top: 58,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 26,
        maxWidth: 480,
        pointerEvents: 'auto',
      }}
      className="animate-slide-down"
    >
      <div className="console-panel" style={{ padding: '12px 16px', borderLeft: '3px solid #22637E' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span className="console-section-title" style={{ color: '#22637E' }}>Your Mission</span>
          <button
            className="console-btn"
            style={{ padding: '1px 7px', fontSize: 10, lineHeight: 1.5 }}
            onClick={() => setDismissed(true)}
            aria-label="Dismiss briefing"
          >
            ✕
          </button>
        </div>
        <ol style={{ fontSize: 12, lineHeight: 1.6, color: '#1C2530', paddingLeft: 18, margin: 0 }}>
          <li>Pick a crisis on the left and start your shift — the grid runs on real physics.</li>
          <li>Keep all six districts powered. Watch <b>Corridor stress</b>: protection trips lines at 100&nbsp;%.</li>
          <li>Act through <b>Operator Actions</b> — every choice is measured, and the mentor tells you what actually worked.</li>
        </ol>
      </div>
    </div>
  );
}
