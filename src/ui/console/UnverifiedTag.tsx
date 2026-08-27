/**
 * UnverifiedTag — the console withdrawing its endorsement of its own instruments.
 *
 * The cyber-attack scenario's distinctive mechanic. The brief asked for "some
 * displayed values are WRONG", and that is the one thing this codebase must
 * not do: the frozen doctrine makes the simulation the single source of truth,
 * a renderer that falsifies measured state is precisely the failure the whole
 * architecture exists to prevent, and it would poison the after-action
 * evidence, which grades decisions against the telemetry the player saw.
 *
 * So the mechanic is inverted. Every number stays true; the console stops
 * vouching for it. That is both honest and closer to the real problem — an
 * operator during a SCADA intrusion is not reading fabricated numbers, they
 * are reading numbers whose provenance they cannot prove, and deciding anyway.
 */
import { useTelemetryTrustStore } from '@state';
import type { ReactElement } from 'react';

/** Inline chip for a panel header. Renders nothing while trust is intact. */
export function UnverifiedTag(): ReactElement | null {
  const compromised = useTelemetryTrustStore((s) => s.compromised);
  if (!compromised) return null;

  return (
    <span
      className="console-value"
      title="Instrument provenance cannot be authenticated. The values shown are the grid's real measurements, but the console cannot prove they arrived unaltered."
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: '#B4531F',
        background: 'rgba(180, 83, 31, 0.1)',
        border: '1px solid rgba(180, 83, 31, 0.45)',
        borderRadius: 3,
        padding: '1px 5px',
        cursor: 'help',
      }}
    >
      UNVERIFIED
    </span>
  );
}

/** Full-width explanation strip. Renders nothing while trust is intact. */
export function TelemetryTrustNotice(): ReactElement | null {
  const compromised = useTelemetryTrustStore((s) => s.compromised);
  const reason = useTelemetryTrustStore((s) => s.reason);
  if (!compromised) return null;

  return (
    <div
      role="status"
      style={{
        marginBottom: 6,
        padding: '6px 8px',
        border: '1px solid rgba(180, 83, 31, 0.4)',
        background: 'rgba(180, 83, 31, 0.07)',
        borderRadius: 4,
      }}
    >
      <div className="console-section-title" style={{ fontSize: 9.5, color: '#B4531F' }}>
        Telemetry integrity
      </div>
      <div style={{ fontSize: 10.5, lineHeight: 1.4, color: '#1C2530', marginTop: 2 }}>
        {reason ?? 'Instrument provenance cannot be authenticated.'}
      </div>
      <div style={{ fontSize: 10, lineHeight: 1.4, color: '#5A6774', marginTop: 3 }}>
        These readings are the grid&apos;s real measurements — the console simply cannot prove they
        reached you unaltered. Corroborate against the city before you act.
      </div>
    </div>
  );
}
