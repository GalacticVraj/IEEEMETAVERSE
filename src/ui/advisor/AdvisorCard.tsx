/**
 * AdvisorCard — the in-play mentor's single, dismissible voice. Renders the
 * current advisor message (evidence-grounded, from the advisor store) top-
 * center under the command bar. Auto-expires; never stacks; never covers the
 * Mission Control rails.
 */
import { useEffect } from 'react';
import type { ReactElement } from 'react';

import { useAdvisorStore } from '@state';

const KIND_LABEL: Record<string, string> = {
  question: 'ADVISOR · THINK AHEAD',
  explanation: 'ADVISOR · WHAT JUST HAPPENED',
  reinforcement: 'ADVISOR · WELL HELD',
  feedback: 'ADVISOR · MEASURED RESULT',
};

const KIND_COLOR: Record<string, string> = {
  question: '#22637E',
  explanation: '#B4531F',
  reinforcement: '#217A56',
  feedback: '#22637E',
};

/** Message lifetime on screen. */
const AUTO_EXPIRE_MS = 14_000;

export function AdvisorCard(): ReactElement | null {
  const message = useAdvisorStore((s) => s.current);
  const dismiss = useAdvisorStore((s) => s.dismiss);

  useEffect(() => {
    if (message === null) return;
    const timer = setTimeout(dismiss, AUTO_EXPIRE_MS);
    return () => clearTimeout(timer);
  }, [message, dismiss]);

  if (message === null) return null;

  const accent = KIND_COLOR[message.kind] ?? '#22637E';

  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 26,
        maxWidth: 520,
        width: 'calc(100% - 680px)',
        minWidth: 320,
        pointerEvents: 'auto',
      }}
      className="animate-slide-down"
    >
      <div
        className="console-panel"
        style={{ padding: '12px 16px', borderLeft: `4px solid ${accent}` }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <span
            className="console-section-title"
            style={{ color: accent, fontSize: 11, fontWeight: 700 }}
          >
            {KIND_LABEL[message.kind] ?? 'ADVISOR'}
          </span>
          <button
            className="console-btn"
            style={{ padding: '2px 8px', fontSize: 11, minHeight: 24, borderRadius: 4 }}
            onClick={dismiss}
            aria-label="Dismiss advisor message"
          >
            ✕
          </button>
        </div>
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: '#1C2530', fontWeight: 500 }}>
          {message.text}
        </div>
      </div>
    </div>
  );
}
