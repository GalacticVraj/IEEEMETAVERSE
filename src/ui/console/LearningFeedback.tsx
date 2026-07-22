/**
 * LearningFeedback — ONE contextual teaching card, no toast spam.
 *
 * Shows the clicked timeline entry, or else the most recent warning/critical
 * event. Three labeled rows answer: what happened, why, what can you do.
 */
import { useEventLogStore } from '@state';
import { useState } from 'react';
import type { ReactElement } from 'react';

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

  return (
    <div className="console-panel" style={{ padding: '10px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span className="console-section-title">Understanding</span>
        <button
          className="console-btn"
          style={{ padding: '1px 7px', fontSize: 10, lineHeight: 1.5 }}
          onClick={dismiss}
          aria-label="Dismiss explanation"
        >
          ✕
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div>
          <div className="console-section-title" style={{ fontSize: 10, marginBottom: 2 }}>What happened</div>
          <div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#1C2530' }}>{entry.what}</div>
        </div>
        <div>
          <div className="console-section-title" style={{ fontSize: 10, marginBottom: 2 }}>Why</div>
          <div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#1C2530' }}>{entry.why}</div>
        </div>
        <div>
          <div className="console-section-title" style={{ fontSize: 10, marginBottom: 2 }}>What you can do</div>
          <div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#1C2530' }}>{entry.action}</div>
        </div>
      </div>
    </div>
  );
}
