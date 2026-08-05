/**
 * GridHealthPanel — compact vital signs. Every metric is live simulation
 * output, and every row carries a one-line meaning so the numbers teach.
 *
 * The meanings are what make this panel teach — and also what make it 420px
 * tall, which is most of the rail. So they show while the persona is teaching
 * and collapse afterwards, leaving the numbers themselves always visible. The
 * player can toggle them back at any time.
 */
import { useGridStore, useSimulationStore, useTutorialStore } from '@state';
import { useState } from 'react';
import type { ReactElement } from 'react';

import { HEALTH_MEANINGS, estimateHouseholdsAffected } from './learning-copy';

function Row({
  label,
  value,
  meaning,
  showMeaning,
  tone,
}: {
  label: string;
  value: string;
  meaning: string;
  showMeaning: boolean;
  tone?: string | undefined;
}): ReactElement {
  return (
    <div style={{ padding: showMeaning ? '6px 0' : '3px 0', borderBottom: '1px solid #E7E9E6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: '#5A6774' }}>{label}</span>
        <span
          className="console-value"
          style={{ fontSize: 13, fontWeight: 600, color: tone ?? '#1C2530' }}
        >
          {value}
        </span>
      </div>
      {showMeaning && (
        <div style={{ fontSize: 10.5, color: '#8B97A3', marginTop: 1 }}>{meaning}</div>
      )}
    </div>
  );
}

export function GridHealthPanel(): ReactElement {
  const totalLoad = useGridStore((s) => s.totalLoad);
  const totalGeneration = useGridStore((s) => s.totalGeneration);
  const renewableGeneration = useGridStore((s) => s.renewableGeneration);
  const frequency = useGridStore((s) => s.frequency);
  const zones = useGridStore((s) => s.zones);
  const maxLineLoading = useSimulationStore((s) => s.maxLineLoading);
  const teaching = useTutorialStore((s) => s.active);
  // Explanations follow the teaching by default; an explicit toggle wins.
  const [override, setOverride] = useState<boolean | null>(null);
  const showMeanings = override ?? teaching;

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
        <span className="console-section-title">Grid Health</span>
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
      <Row
        label="Demand"
        value={`${Math.round(totalLoad)} MW`}
        meaning={HEALTH_MEANINGS.demand}
        showMeaning={showMeanings}
      />
      <Row
        label="Generation"
        value={`${Math.round(totalGeneration)} MW`}
        meaning={HEALTH_MEANINGS.generation}
        showMeaning={showMeanings}
      />
      <Row
        label="Balance"
        value={`${balance >= 0 ? '+' : '−'}${Math.abs(Math.round(balance))} MW`}
        meaning={HEALTH_MEANINGS.balance}
        showMeaning={showMeanings}
        tone={balanceTone}
      />
      <Row
        label="Frequency"
        value={`${frequency.toFixed(2)} Hz`}
        meaning={HEALTH_MEANINGS.frequency}
        showMeaning={showMeanings}
      />
      <Row
        label="Renewables"
        value={`${Math.round(renewablePct)} %`}
        meaning={HEALTH_MEANINGS.renewables}
        showMeaning={showMeanings}
      />
      <Row
        label="Corridor stress"
        value={`${stressPct} %`}
        meaning={HEALTH_MEANINGS.corridorStress}
        showMeaning={showMeanings}
        tone={stressTone}
      />
      <Row
        label="Zones dark"
        value={
          darkZones.length === 0
            ? '0'
            : `${darkZones.length} · ≈${estimateHouseholdsAffected(unservedMw).toLocaleString()} homes`
        }
        meaning={HEALTH_MEANINGS.zonesDark}
        showMeaning={showMeanings}
        tone={darkZones.length > 0 ? '#B3261E' : undefined}
      />
    </div>
  );
}
