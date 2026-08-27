/**
 * DemoWatermark — the honesty label on an unattended run.
 *
 * Presentation mode plays itself. Anyone walking past a looping screen has to
 * be able to tell at a glance that nobody is at the controls — otherwise the
 * demo is implicitly claiming a human achieved this, which is exactly the kind
 * of small dishonesty a judging panel is right to punish.
 *
 * Deliberately small, in the corner, and never over the city or the rail.
 */
import type { ReactElement } from 'react';

import { useDemoStore } from './demo-store';

export function DemoWatermark(): ReactElement | null {
  const presentation = useDemoStore((s) => s.presentation);
  if (!presentation) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        right: 14,
        top: 58,
        zIndex: 46,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 11px',
        borderRadius: 6,
        background: 'rgba(28, 37, 48, 0.82)',
        border: '1px solid rgba(250, 250, 247, 0.22)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <span className="status-led" style={{ background: '#F1544B' }} />
      <span
        className="console-value"
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: '#FAFAF7',
          whiteSpace: 'nowrap',
        }}
      >
        DEMO MODE · IEEE METAVERSE 2026
      </span>
      <span style={{ fontSize: 9.5, color: '#A7B2BC', whiteSpace: 'nowrap' }}>
        unattended · 1.5×
      </span>
    </div>
  );
}
