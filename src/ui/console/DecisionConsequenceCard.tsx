/**
 * DecisionConsequenceCard — how your call actually turned out.
 *
 * Appears 30 simulated seconds after a decision is committed, quoting the
 * before/after numbers the director measured. It is deliberately NOT the same
 * beat as the advisor's evidence feedback, which lands ~5 s in and answers
 * "did that move anything". This answers the later, harder question: "and did
 * it hold".
 *
 * Every figure on this card was measured by the engine. The card computes
 * nothing — not even the verdict, which arrives on the event.
 */
import { useDecisionConsequenceStore } from '@state';
import { useEffect } from 'react';
import type { ReactElement } from 'react';

import { simClock } from './learning-copy';

/** How long the card stays before it lets go, ms. */
const VISIBLE_MS = 12_000;

const TONE = {
  improved: { accent: '#217A56', surface: 'rgba(243, 250, 246, 0.97)', label: 'IT WORKED' },
  held: { accent: '#22637E', surface: 'rgba(244, 249, 251, 0.97)', label: 'NO CHANGE' },
  worsened: { accent: '#B3261E', surface: 'rgba(253, 240, 238, 0.97)', label: 'IT COST YOU' },
} as const;

function Delta({
  label,
  before,
  after,
  format,
  lowerIsBetter = true,
}: {
  label: string;
  before: number;
  after: number;
  format: (value: number) => string;
  lowerIsBetter?: boolean;
}): ReactElement {
  const improved = lowerIsBetter ? after < before : after > before;
  const changed = Math.abs(after - before) > 1e-6;
  const color = !changed ? '#5A6774' : improved ? '#217A56' : '#B3261E';

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
      <span style={{ fontSize: 11, color: '#5A6774' }}>{label}</span>
      <span className="console-value" style={{ fontSize: 11 }}>
        <span style={{ color: '#8B97A3' }}>{format(before)}</span>
        <span style={{ color: '#C3C9C3', margin: '0 5px' }}>→</span>
        <span style={{ color, fontWeight: 700 }}>{format(after)}</span>
      </span>
    </div>
  );
}

export function DecisionConsequenceCard(): ReactElement | null {
  const current = useDecisionConsequenceStore((s) => s.current);
  const dismiss = useDecisionConsequenceStore((s) => s.dismiss);

  useEffect(() => {
    if (current === null) return;
    const timer = setTimeout(dismiss, VISIBLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [current, dismiss]);

  if (current === null) return null;

  const tone = TONE[current.verdict];

  return (
    <div
      role="status"
      className="animate-fade-in-up"
      style={{
        position: 'absolute',
        left: 340,
        bottom: 192,
        width: 340,
        padding: '10px 13px',
        background: tone.surface,
        border: '1px solid rgba(211, 215, 210, 0.9)',
        borderLeft: `4px solid ${tone.accent}`,
        borderRadius: 8,
        boxShadow: '0 8px 24px -4px rgba(28, 37, 48, 0.16)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        pointerEvents: 'auto',
        zIndex: 30,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 3,
        }}
      >
        <span className="console-section-title" style={{ color: tone.accent, fontSize: 10 }}>
          Decision consequence · {tone.label}
        </span>
        <button
          className="console-btn"
          style={{ padding: '0 6px', fontSize: 10, minHeight: 18, lineHeight: 1.6 }}
          onClick={dismiss}
          aria-label="Dismiss consequence"
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#1C2530', marginBottom: 6 }}>
        {current.summary}
      </div>

      <div style={{ borderTop: '1px solid #E7E9E6', paddingTop: 4 }}>
        <Delta
          label="Frequency deviation"
          before={current.deviationBeforeHz}
          after={current.deviationAfterHz}
          format={(v) => `${v.toFixed(2)} Hz`}
        />
        <Delta
          label="Worst corridor"
          before={current.loadingBefore}
          after={current.loadingAfter}
          format={(v) => `${String(Math.round(v * 100))} %`}
        />
        <Delta
          label="Districts dark"
          before={current.darkZonesBefore}
          after={current.darkZonesAfter}
          format={(v) => String(v)}
        />
      </div>

      <div style={{ fontSize: 9.5, color: '#8B97A3', marginTop: 5 }}>
        Measured 30 s after your call at {simClock(current.committedTick)}.
      </div>
    </div>
  );
}
