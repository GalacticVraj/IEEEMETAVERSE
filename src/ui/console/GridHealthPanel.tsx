/**
 * GridHealthPanel — compact vital signs. Every metric is live simulation
 * output, and every row carries a one-line meaning so the numbers teach.
 */
import { useGridStore, useSimulationStore } from '@state';
import type { ReactElement } from 'react';

import { HEALTH_MEANINGS, estimateHouseholdsAffected } from './learning-copy';
import { PanelHeader } from './PanelHeader';
import { Tooltip } from '../common/Tooltip';

function ActivityIcon(): ReactElement {
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
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function Row({
  label,
  value,
  meaning,
  tone,
  isCritical,
  tooltipTitle,
  tooltipContent,
}: {
  label: string;
  value: string;
  meaning: string;
  tone?: string | undefined;
  isCritical?: boolean | undefined;
  tooltipTitle: string;
  tooltipContent: string;
}): ReactElement {
  return (
    <Tooltip title={tooltipTitle} content={tooltipContent} position="right">
      <div
        style={{
          width: '100%',
          padding: '7px 0',
          borderBottom: '1px solid rgba(231, 233, 230, 0.7)',
          background: isCritical ? 'rgba(179, 38, 30, 0.04)' : 'transparent',
          borderRadius: isCritical ? 4 : 0,
          paddingLeft: isCritical ? 6 : 0,
          paddingRight: isCritical ? 6 : 0,
          cursor: 'help',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="metric-label">{label}</span>
          <span className="metric-value" style={{ color: tone ?? '#1C2530' }}>
            {value}
          </span>
        </div>
        <div style={{ fontSize: 10.5, color: '#8B97A3', marginTop: 2, lineHeight: 1.2 }}>
          {meaning}
        </div>
      </div>
    </Tooltip>
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
  const stressTone =
    stressPct >= 100
      ? '#B3261E'
      : stressPct >= 80
        ? '#B4531F'
        : stressPct >= 60
          ? '#9A6B15'
          : '#217A56';

  return (
    <div className="console-panel animate-fade-in-up" style={{ padding: '12px 14px' }}>
      <PanelHeader
        title="GRID HEALTH"
        subtitle="Live health of the electrical network"
        icon={<ActivityIcon />}
      />

      <Row
        label="Demand"
        value={`${Math.round(totalLoad)} MW`}
        meaning={HEALTH_MEANINGS.demand}
        tooltipTitle="Total Electrical Demand"
        tooltipContent="Sum of all residential, commercial, industrial, and municipal loads across Meridian Bay."
      />
      <Row
        label="Generation"
        value={`${Math.round(totalGeneration)} MW`}
        meaning={HEALTH_MEANINGS.generation}
        tooltipTitle="Total Fleet Generation"
        tooltipContent="Combined real-time output from solar, wind, battery, gas peakers, and baseload power plants."
      />
      <Row
        label="Balance"
        value={`${balance >= 0 ? '+' : '−'}${Math.abs(Math.round(balance))} MW`}
        meaning={HEALTH_MEANINGS.balance}
        tone={balanceTone}
        isCritical={balance < -50}
        tooltipTitle="Supply-Demand Balance"
        tooltipContent="Negative balance causes frequency drops and risks cascade trips if reserve generators cannot ramp."
      />
      <Row
        label="Frequency"
        value={`${frequency.toFixed(2)} Hz`}
        meaning={HEALTH_MEANINGS.frequency}
        tooltipTitle="AC Network Frequency"
        tooltipContent="60.00 Hz nominal. Below 59.5 Hz triggers under-frequency load shedding relays."
      />
      <Row
        label="Renewables"
        value={`${Math.round(renewablePct)} %`}
        meaning={HEALTH_MEANINGS.renewables}
        tooltipTitle="Renewable Generation Share"
        tooltipContent="Percentage of total load currently powered by clean wind, solar, and battery storage."
      />
      <Row
        label="Corridor stress"
        value={`${stressPct} %`}
        meaning={HEALTH_MEANINGS.corridorStress}
        tone={stressTone}
        isCritical={stressPct >= 90}
        tooltipTitle="Max Corridor Thermal Stress"
        tooltipContent="Highest loading percentage on any transmission corridor. Relays automatically open line breakers at 100%!"
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
        isCritical={darkZones.length > 0}
        tooltipTitle="Blackout Districts"
        tooltipContent="Number of city districts currently de-energized. Restore transmission corridors to re-power affected homes."
      />
    </div>
  );
}
