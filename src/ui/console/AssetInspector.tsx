/**
 * AssetInspector — right-panel inspector for the selected 3D asset.
 *
 * Reads ONLY from projections (ui-store selection, grid-store telemetry) and
 * static topology. Every number shown is live simulation output or topology
 * data; explanations come from learning-copy.
 */
import { MERIDIAN_BAY_TOPOLOGY } from '@engine/topology/meridian-bay';
import { useGridStore, useUiStore } from '@state';
import type { ReactElement } from 'react';

import {
  buildingNote,
  explainBus,
  explainGenerator,
  explainLine,
  zoneDisplayName,
  zoneOfBuilding,
} from './learning-copy';
import { PanelHeader } from './PanelHeader';

const TONE_COLOR: Record<string, string> = {
  nominal: '#217A56',
  caution: '#9A6B15',
  warning: '#B4531F',
  critical: '#B3261E',
  offline: '#5F6B76',
  recovery: '#217A56',
};

function TargetIcon(): ReactElement {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): ReactElement {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="console-section-title" style={{ marginBottom: 4, fontSize: 10 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.5, color: '#1C2530' }}>{children}</div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string | undefined;
}): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '4px 0',
        borderBottom: '1px solid rgba(231, 233, 230, 0.5)',
      }}
    >
      <span className="metric-label">{label}</span>
      <span className="metric-value" style={{ color: tone ?? '#1C2530' }}>
        {value}
      </span>
    </div>
  );
}

function StatusRow({ label, tone }: { label: string; tone: string }): ReactElement {
  const color = TONE_COLOR[tone] ?? TONE_COLOR['offline']!;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: '6px 0 12px',
        padding: '4px 8px',
        background: `${color}10`,
        borderRadius: 4,
      }}
    >
      <span className="status-led" style={{ background: color }} />
      <span
        className="console-value"
        style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.04em' }}
      >
        {label}
      </span>
    </div>
  );
}

export function AssetInspector(): ReactElement | null {
  const selected = useUiStore((s) => s.selectedAsset);
  const selectAsset = useUiStore((s) => s.selectAsset);
  const lines = useGridStore((s) => s.lines);
  const zones = useGridStore((s) => s.zones);
  const generators = useGridStore((s) => s.generators);

  if (selected === null) {
    return null;
  }

  const close = (): void => selectAsset(null);

  let body: ReactElement | null = null;
  let title = selected.id;
  let subtitle = '';

  if (selected.kind === 'line') {
    const topo = MERIDIAN_BAY_TOPOLOGY.lines.find((l) => (l.id as string) === selected.id);
    const flow = lines.find((f) => (f.line as string) === selected.id);
    const zonesTouched = topo
      ? [
          ...new Set(
            [topo.from, topo.to].map(
              (n) => MERIDIAN_BAY_TOPOLOGY.nodes.find((node) => node.id === n)?.zone as string,
            ),
          ),
        ].filter(Boolean)
      : [];
    const explanation = explainLine(flow, zonesTouched);
    subtitle = 'Transmission line · 230 kV';
    body = (
      <>
        <StatusRow label={explanation.statusLabel} tone={explanation.statusTone} />
        <Section title="Live telemetry">
          <MetricRow label="Flow" value={flow ? `${Math.abs(Math.round(flow.flow))} MW` : '—'} />
          <MetricRow
            label="Loading"
            value={flow ? `${Math.round((flow.loading as number) * 100)} %` : '—'}
            tone={TONE_COLOR[explanation.statusTone]}
          />
          <MetricRow label="Capacity" value={topo ? `${topo.capacity} MW` : '—'} />
          <MetricRow label="Corridor" value={topo ? `${topo.from} → ${topo.to}` : '—'} />
        </Section>
        <Section title="Why">{explanation.cause}</Section>
        <Section title="Impact">{explanation.impact}</Section>
        <Section title="Recommended">{explanation.action}</Section>
      </>
    );
  } else if (selected.kind === 'generator') {
    const topo = MERIDIAN_BAY_TOPOLOGY.generators.find((g) => (g.id as string) === selected.id);
    const live = generators.find((g) => (g.id as string) === selected.id);
    const explanation = explainGenerator(
      selected.id,
      live?.outputMw,
      (topo?.capacity as number) ?? 0,
      live?.tripped ?? false,
    );
    title = explanation.name;
    subtitle = `${topo?.kind ?? 'Generator'} · bus ${topo?.node ?? '—'}`;
    body = (
      <>
        <StatusRow label={explanation.statusLabel} tone={explanation.statusTone} />
        <Section title="Live telemetry">
          <MetricRow label="Output" value={live ? `${Math.round(live.outputMw)} MW` : '—'} />
          <MetricRow label="Capacity" value={topo ? `${topo.capacity} MW` : '—'} />
          <MetricRow
            label="Utilization"
            value={
              live && topo && (topo.capacity as number) > 0
                ? `${Math.round(((live.outputMw as number) / (topo.capacity as number)) * 100)} %`
                : '—'
            }
          />
        </Section>
        <Section title="Why">{explanation.cause}</Section>
        <Section title="Impact">{explanation.impact}</Section>
        <Section title="Recommended">{explanation.action}</Section>
      </>
    );
  } else if (selected.kind === 'bus') {
    const node = MERIDIAN_BAY_TOPOLOGY.nodes.find((n) => (n.id as string) === selected.id);
    const zoneId = (node?.zone as string) ?? '';
    const zoneStatus = zones.find((z) => (z.zone as string) === zoneId);
    const connected = MERIDIAN_BAY_TOPOLOGY.lines.filter(
      (l) => (l.from as string) === selected.id || (l.to as string) === selected.id,
    );
    const explanation = explainBus(zoneId, zoneStatus);
    subtitle = `Substation bus · ${zoneDisplayName(zoneId)}`;
    const tone =
      zoneStatus?.state === 'Blackout'
        ? 'critical'
        : zoneStatus?.state === 'Degraded'
          ? 'warning'
          : 'nominal';
    body = (
      <>
        <StatusRow label={zoneStatus?.state?.toUpperCase() ?? 'POWERED'} tone={tone} />
        <Section title="Live telemetry">
          <MetricRow
            label="Zone served"
            value={zoneStatus ? `${Math.round(zoneStatus.servedLoad)} MW` : '—'}
          />
          <MetricRow
            label="Zone unserved"
            value={zoneStatus ? `${Math.round(zoneStatus.unservedLoad)} MW` : '—'}
            tone={
              zoneStatus && (zoneStatus.unservedLoad as number) > 0
                ? TONE_COLOR['critical']
                : undefined
            }
          />
          <MetricRow label="Connected lines" value={String(connected.length)} />
        </Section>
        <Section title="Why">{explanation.cause}</Section>
        <Section title="Impact">{explanation.impact}</Section>
        <Section title="Recommended">{explanation.action}</Section>
      </>
    );
  } else {
    // building
    const info = buildingNote(selected.id);
    const zoneId = zoneOfBuilding(selected.id);
    const zoneStatus = zones.find((z) => (z.zone as string) === zoneId);
    const dark = zoneStatus?.state === 'Blackout';
    title = info.name;
    subtitle = `${info.role} · ${zoneDisplayName(zoneId)}`;
    body = (
      <>
        <StatusRow label={dark ? 'BLACKOUT' : 'POWERED'} tone={dark ? 'critical' : 'nominal'} />
        <Section title="Priority">
          <MetricRow label="Tier" value={`${info.priorityTier} — ${info.priorityLabel}`} />
        </Section>
        <Section title="What this teaches">{info.teachingNote}</Section>
        {info.equityNote ? <Section title="Equity">{info.equityNote}</Section> : null}
        <Section title="Impact">
          {dark
            ? `This building is inside a blacked-out zone (${zoneDisplayName(zoneId)}).`
            : `Served by the ${zoneDisplayName(zoneId)} distribution network.`}
        </Section>
      </>
    );
  }

  const closeButton = (
    <button
      className="console-btn"
      style={{ padding: '2px 8px', fontSize: 11, minHeight: 24, borderRadius: 4 }}
      onClick={close}
      aria-label="Close inspector"
    >
      ✕
    </button>
  );

  return (
    <div
      className="console-panel animate-slide-in-right"
      style={{ padding: '12px 14px', overflowY: 'auto', maxHeight: '100%' }}
    >
      <PanelHeader
        title={title}
        subtitle={subtitle || 'Information about the selected infrastructure'}
        icon={<TargetIcon />}
        action={closeButton}
      />
      {body}
    </div>
  );
}
