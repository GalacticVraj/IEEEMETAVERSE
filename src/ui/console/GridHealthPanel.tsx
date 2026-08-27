/**
 * GridHealthPanel — compact vital signs. Every metric is live simulation
 * output, and every row carries a one-line meaning so the numbers teach.
 *
 * The meanings are what make this panel teach — and also what make it tall,
 * which is most of the rail. So they show while the persona is teaching and
 * collapse afterwards, leaving the numbers themselves always visible. The
 * player can toggle them back at any time.
 *
 * Collapsed, the vitals lay out as a TWO-COLUMN instrument cluster rather than
 * a single stack. The stack measured 323px, which at 1366×768 left the rail's
 * scroll area only 191px for the inspector AND all five operator levers — the
 * levers were effectively invisible. Paired, the same numbers cost ~200px.
 */
import { useGridStore, useSimulationStore, useTutorialStore } from '@state';
import { useState } from 'react';
import type { ReactElement } from 'react';

import { HEALTH_MEANINGS, estimateHouseholdsAffected } from './learning-copy';
import { FrequencyGauge } from './FrequencyGauge';
import { TelemetryTrustNotice, UnverifiedTag } from './UnverifiedTag';

interface Vital {
  readonly label: string;
  readonly value: string;
  readonly meaning: string;
  readonly tone?: string | undefined;
  /** Wide vitals keep the full row even in the paired layout. */
  readonly wide?: boolean;
}

function Row({ vital, showMeaning }: { vital: Vital; showMeaning: boolean }): ReactElement {
  return (
    <div style={{ padding: showMeaning ? '6px 0' : '3px 0', borderBottom: '1px solid #E7E9E6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: '#5A6774' }}>{vital.label}</span>
        <span
          className="console-value"
          style={{ fontSize: 13, fontWeight: 600, color: vital.tone ?? '#1C2530' }}
        >
          {vital.value}
        </span>
      </div>
      {showMeaning && (
        <div style={{ fontSize: 10.5, color: '#8B97A3', marginTop: 1 }}>{vital.meaning}</div>
      )}
    </div>
  );
}

/** Paired layout: label above value, two per line, no wasted horizontal run. */
function Cell({ vital }: { vital: Vital }): ReactElement {
  return (
    <div
      title={vital.meaning}
      style={{
        padding: '3px 0',
        borderBottom: '1px solid #E7E9E6',
        gridColumn: vital.wide === true ? '1 / -1' : undefined,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 10,
          lineHeight: 1.2,
          color: '#8B97A3',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {vital.label}
      </div>
      <div
        className="console-value"
        style={{
          fontSize: 13,
          lineHeight: 1.25,
          fontWeight: 700,
          color: vital.tone ?? '#1C2530',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {vital.value}
      </div>
    </div>
  );
}

/**
 * Pre-flight state: no run has produced any telemetry yet.
 *
 * Before this existed the panel rendered its full instrument cluster against
 * an empty projection — eleven readings of "0 MW", a frequency gauge parked at
 * nominal, and 311px of rail consumed to say nothing. At 1366×768 that pushed
 * the scenario picker's own "Start Scenario" button below the fold, which is
 * how a player could find themselves unable to begin a run at all.
 *
 * A grid that has not been switched on should say so, in one line.
 */
function StandbyCard(): ReactElement {
  return (
    <div className="console-panel" style={{ padding: '10px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="status-led" style={{ background: '#5F6B76' }} aria-hidden />
        <span className="console-section-title">Grid Health — Standby</span>
      </div>
      <div style={{ fontSize: 11, color: '#5A6774', marginTop: 4, lineHeight: 1.45 }}>
        No telemetry yet. Vitals, the frequency gauge and the operator levers all arm the moment
        your shift starts.
      </div>
    </div>
  );
}

export function GridHealthPanel(): ReactElement {
  const hasTelemetry = useGridStore((s) => s.zones.length > 0);
  const totalLoad = useGridStore((s) => s.totalLoad);
  const totalGeneration = useGridStore((s) => s.totalGeneration);
  const renewableGeneration = useGridStore((s) => s.renewableGeneration);
  const security = useGridStore((s) => s.security);
  const reserveMw = useGridStore((s) => s.reserveMw);
  const largestInfeedMw = useGridStore((s) => s.largestInfeedMw);
  const inertiaMwS = useGridStore((s) => s.inertiaMwS);
  const uflsStage = useGridStore((s) => s.uflsStage);
  const zones = useGridStore((s) => s.zones);
  const maxLineLoading = useSimulationStore((s) => s.maxLineLoading);
  const teaching = useTutorialStore((s) => s.active);
  // Explanations follow the teaching by default; an explicit toggle wins.
  const [override, setOverride] = useState<boolean | null>(null);
  const showMeanings = override ?? teaching;

  // Frequency and RoCoF now live in `FrequencyGauge`, which owns their colour
  // thresholds too — the numbers were being toned in two places, and the rail
  // could not afford to carry them twice.
  const securityTone =
    security === 'Insecure' ? '#B3261E' : security === 'AtRisk' ? '#9A6B15' : '#217A56';

  const balance = totalGeneration - totalLoad;
  const renewablePct = totalGeneration > 0 ? (renewableGeneration / totalGeneration) * 100 : 0;
  const darkZones = zones.filter((z) => z.state === 'Blackout');
  const unservedMw = darkZones.reduce((sum, z) => sum + (z.unservedLoad as number), 0);
  const stressPct = Math.round(maxLineLoading * 100);

  const balanceTone = balance < -50 ? '#B3261E' : balance < 0 ? '#9A6B15' : '#217A56';
  const stressTone =
    stressPct >= 100
      ? '#B3261E'
      : stressPct >= 80
        ? '#B4531F'
        : stressPct >= 60
          ? '#9A6B15'
          : '#217A56';

  // Hooks above, branch below — the standby card must not change hook order.
  if (!hasTelemetry) return <StandbyCard />;

  const vitals: readonly Vital[] = [
    { label: 'Demand', value: `${Math.round(totalLoad)} MW`, meaning: HEALTH_MEANINGS.demand },
    {
      label: 'Generation',
      value: `${Math.round(totalGeneration)} MW`,
      meaning: HEALTH_MEANINGS.generation,
    },
    {
      label: 'Balance',
      value: `${balance >= 0 ? '+' : '−'}${Math.abs(Math.round(balance))} MW`,
      meaning: HEALTH_MEANINGS.balance,
      tone: balanceTone,
    },
    // Frequency and RoCoF are NOT rows any more — the gauge above shows both,
    // and carrying them twice cost ~40px of a rail that has been overflowed
    // before. Their teaching copy moves onto the gauge's tooltip.
    {
      label: 'System inertia',
      value: `${Math.round(inertiaMwS).toLocaleString()} MW·s`,
      meaning: HEALTH_MEANINGS.inertia,
    },
    {
      label: 'N-1 security',
      value:
        security === 'Secure'
          ? `Secure · ${Math.round(reserveMw)} MW reserve`
          : `${security} · ${Math.round(reserveMw)} vs ${Math.round(largestInfeedMw)} MW`,
      meaning: HEALTH_MEANINGS.security,
      tone: securityTone,
      wide: true,
    },
    ...(uflsStage > 0
      ? [
          {
            label: 'Auto load shed',
            value: `Stage ${String(uflsStage)} fired`,
            meaning: HEALTH_MEANINGS.ufls,
            tone: '#B3261E',
            wide: true,
          } as const,
        ]
      : []),
    {
      label: 'Renewables',
      value: `${Math.round(renewablePct)} %`,
      meaning: HEALTH_MEANINGS.renewables,
    },
    {
      label: 'Corridor stress',
      value: `${stressPct} %`,
      meaning: HEALTH_MEANINGS.corridorStress,
      tone: stressTone,
    },
    {
      label: 'Zones dark',
      value:
        darkZones.length === 0
          ? '0'
          : `${darkZones.length} · ≈${estimateHouseholdsAffected(unservedMw).toLocaleString()} homes`,
      meaning: HEALTH_MEANINGS.zonesDark,
      tone: darkZones.length > 0 ? '#B3261E' : undefined,
      wide: darkZones.length > 0,
    },
  ];

  return (
    <div className="console-panel" style={{ padding: '10px 14px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="console-section-title">Grid Health</span>
          <UnverifiedTag />
        </span>
        <button
          className="console-btn"
          style={{ padding: '1px 7px', fontSize: 10, lineHeight: 1.5 }}
          onClick={() => setOverride(!showMeanings)}
          aria-pressed={showMeanings}
          title={showMeanings ? 'Hide what each metric means' : 'Show what each metric means'}
        >
          {showMeanings ? '−' : '?'}
        </button>
      </div>

      {/* During a SCADA intrusion the numbers below are still the grid's real
          measurements — the console just cannot prove they arrived unaltered. */}
      <TelemetryTrustNotice />

      {/* Frequency gets an instrument rather than a row. It is the one
          quantity that decides the next thirty seconds, and deviation is far
          easier to read as an angle than as a decimal. The numeric row below
          stays — an operator still needs the exact figure. */}
      <div style={{ padding: '2px 0 8px', borderBottom: '1px solid #E7E9E6', marginBottom: 4 }}>
        <FrequencyGauge />
      </div>

      {showMeanings ? (
        vitals.map((vital) => <Row key={vital.label} vital={vital} showMeaning />)
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            columnGap: 14,
          }}
        >
          {vitals.map((vital) => (
            <Cell key={vital.label} vital={vital} />
          ))}
        </div>
      )}
    </div>
  );
}
