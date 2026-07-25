/**
 * LearningFeedback — ONE contextual teaching card, no toast spam.
 *
 * Shows the clicked timeline entry, or else the most recent warning/critical
 * event. Three labeled rows answer: what happened, why, what can you do.
 */
import { useEventLogStore } from '@state';
import { useState } from 'react';
import type { ReactElement } from 'react';

import { PanelHeader } from './PanelHeader';

function InfoIcon(): ReactElement {
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
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export function LearningFeedback(): ReactElement | null {
  const entries = useEventLogStore((s) => s.entries);
  const focusedSeq = useEventLogStore((s) => s.focusedSeq);
  const focusEntry = useEventLogStore((s) => s.focusEntry);
  const [dismissedSeq, setDismissedSeq] = useState(0);

  const focused = focusedSeq === null ? undefined : entries.find((e) => e.seq === focusedSeq);
  const latestImportant = [...entries]
    .reverse()
    .find((e) => (e.severity === 'warning' || e.severity === 'critical') && e.seq > dismissedSeq);
  const entry = focused ?? latestImportant;

  if (entry === undefined) return null;

  const dismiss = (): void => {
    if (focused !== undefined) {
      focusEntry(null);
    }
    setDismissedSeq((previous) => Math.max(previous, entry.seq));
  };

  const closeButton = (
    <button
      className="console-btn"
      style={{ padding: '2px 8px', fontSize: 11, minHeight: 24, borderRadius: 4 }}
      onClick={dismiss}
      aria-label="Dismiss explanation"
    >
      ✕
    </button>
  );

  return (
    <div className="console-panel animate-slide-in-right" style={{ padding: '12px 14px' }}>
      <PanelHeader
        title="UNDERSTANDING"
        subtitle="What happened and why"
        icon={<InfoIcon />}
        action={closeButton}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          style={{
            background: 'rgba(34, 99, 126, 0.04)',
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid rgba(34, 99, 126, 0.12)',
          }}
        >
          <div
            className="console-section-title"
            style={{ fontSize: 10, color: '#22637E', marginBottom: 2 }}
          >
            What happened
          </div>
          <div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#1C2530', fontWeight: 500 }}>
            {entry.what}
          </div>
        </div>
        <div>
          <div className="console-section-title" style={{ fontSize: 10, marginBottom: 2 }}>
            Why
          </div>
          <div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#5A6774' }}>{entry.why}</div>
        </div>
        <div>
          <div
            className="console-section-title"
            style={{ fontSize: 10, marginBottom: 2, color: '#217A56' }}
          >
            What you can do
          </div>
          <div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#1C2530' }}>{entry.action}</div>
        </div>
      </div>
    </div>
  );
}
