/**
 * GridHealthPanel — compact vital signs. Every metric is live simulation
 * output, and every row carries a one-line meaning so the numbers teach.
 */
import { useGridStore, useSimulationStore } from '@state';
import type { ReactElement } from 'react';

import { HEALTH_MEANINGS, estimateHouseholdsAffected } from './learning-copy';

function Row({
  label,
  value,
  meaning,
  tone,
}: {
  label: string;
  value: string;
  meaning: string;
  tone?: string | undefined;
}): ReactElement {
  return (
    <div style={{ padding: '6px 0', borderBottom: '1px solid #E7E9E6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: '#5A6774' }}>{label}</span>
        <span className="console-value" style={{ fontSize: 13, fontWeight: 600, color: tone ?? '#1C2530' }}>
          {value}
        </span>
      </div>
      <div style={{ fontSize: 10.5, color: '#8B97A3', marginTop: 1 }}>{meaning}</div>
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

  const balance = totalGeneration - totalLoad;
  const renewablePct = totalGeneration > 0 ? (renewableGeneration / totalGeneration) * 100 : 0;
  const darkZones = zones.filter((z) => z.state === 'Blackout');
  const unservedMw = darkZones.reduce((sum, z) => sum + (z.unservedLoad as number), 0);
  const stressPct = Math.round(maxLineLoading * 100);

  const balanceTone = balance < -50 ? '#B3261E' : balance < 0 ? '#9A6B15' : '#217A56';
  const stressTone = stressPct >= 100 ? '#B3261E' : stressPct >= 80 ? '#B4531F' : stressPct >= 60 ? '#9A6B15' : '#217A56';

  return (
    <div className="console-panel" style={{ padding: '10px 14px' }}>
      <div className="console-section-title" style={{ marginBottom: 4 }}>Grid Health</div>
      <Row label="Demand" value={`${Math.round(totalLoad)} MW`} meaning={HEALTH_MEANINGS.demand} />
      <Row label="Generation" value={`${Math.round(totalGeneration)} MW`} meaning={HEALTH_MEANINGS.generation} />
      <Row
        label="Balance"
        value={`${balance >= 0 ? '+' : '−'}${Math.abs(Math.round(balance))} MW`}
        meaning={HEALTH_MEANINGS.balance}
        tone={balanceTone}
      />
      <Row label="Frequency" value={`${frequency.toFixed(2)} Hz`} meaning={HEALTH_MEANINGS.frequency} />
      <Row label="Renewables" value={`${Math.round(renewablePct)} %`} meaning={HEALTH_MEANINGS.renewables} />
      <Row
        label="Corridor stress"
        value={`${stressPct} %`}
        meaning={HEALTH_MEANINGS.corridorStress}
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
        tone={darkZones.length > 0 ? '#B3261E' : undefined}
      />
    </div>
  );
}
