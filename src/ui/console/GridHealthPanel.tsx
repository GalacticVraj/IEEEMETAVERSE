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
          transition: 'background 0.15s ease',
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
        subtitle="Live status of the electrical grid"
        icon={<ActivityIcon />}
      />

      <Row
        label="Demand"
        value={`${Math.round(totalLoad)} MW`}
        meaning={HEALTH_MEANINGS.demand}
        tooltipTitle="Total Power Demand"
        tooltipContent="Instantaneous electric load consumed across all 6 city districts. High demand during heatwaves stresses power corridors. Watch to prevent supply deficits."
      />
      <Row
        label="Generation"
        value={`${Math.round(totalGeneration)} MW`}
        meaning={HEALTH_MEANINGS.generation}
        tooltipTitle="Total Grid Generation"
        tooltipContent="Active power produced by solar, wind, gas, and storage plants. Must continuously balance demand to maintain 60.00 Hz frequency. Dispatch reserves if demand exceeds generation."
      />
      <Row
        label="Balance"
        value={`${balance >= 0 ? '+' : '−'}${Math.abs(Math.round(balance))} MW`}
        meaning={HEALTH_MEANINGS.balance}
        tone={balanceTone}
        isCritical={balance < -50}
        tooltipTitle="Supply-Demand Balance"
        tooltipContent="Net difference between grid generation and total load. Deficits drop frequency and risk cascade trips. Rebalance generation or execute load interventions immediately."
      />
      <Row
        label="Frequency"
        value={`${frequency.toFixed(2)} Hz`}
        meaning={HEALTH_MEANINGS.frequency}
        tooltipTitle="AC Grid Frequency"
        tooltipContent="System frequency operating at 60.00 Hz nominal. Below 59.50 Hz triggers under-frequency load shedding relays. Monitor closely during sudden generator trips."
      />
      <Row
        label="Renewables"
        value={`${Math.round(renewablePct)} %`}
        meaning={HEALTH_MEANINGS.renewables}
        tooltipTitle="Renewable Power Share"
        tooltipContent="Percentage of city load powered by clean wind, solar, and battery storage. Solar output drops at sunset. Dispatch gas peakers when renewable generation declines."
      />
      <Row
        label="Corridor stress"
        value={`${stressPct} %`}
        meaning={HEALTH_MEANINGS.corridorStress}
        tone={stressTone}
        isCritical={stressPct >= 90}
        tooltipTitle="Peak Corridor Stress"
        tooltipContent="Highest thermal loading on any transmission line. Overcurrent relays automatically trip line breakers at 100%. Reroute or shed load before stress reaches 100%!"
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
        tooltipTitle="Blackout District Count"
        tooltipContent="Number of city districts currently de-energized. Deprives homes and emergency services of power. Reconnect transmission lines to restore electricity."
      />
    </div>
  );
}
