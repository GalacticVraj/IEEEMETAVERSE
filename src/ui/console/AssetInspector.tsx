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

const TONE_COLOR: Record<string, string> = {
  nominal: '#217A56',
  caution: '#9A6B15',
  warning: '#B4531F',
  critical: '#B3261E',
  offline: '#5F6B76',
  recovery: '#217A56',
};

function Section({ title, children }: { title: string; children: React.ReactNode }): ReactElement {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="console-section-title" style={{ marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, lineHeight: 1.5, color: '#1C2530' }}>{children}</div>
    </div>
  );
}

function MetricRow({ label, value, tone }: { label: string; value: string; tone?: string | undefined }): ReactElement {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ fontSize: 12, color: '#5A6774' }}>{label}</span>
      <span className="console-value" style={{ fontSize: 12, color: tone ?? '#1C2530', fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}

function StatusRow({ label, tone }: { label: string; tone: string }): ReactElement {
  const color = TONE_COLOR[tone] ?? TONE_COLOR['offline']!;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0 12px' }}>
      <span className="status-led" style={{ background: color }} />
      <span className="console-value" style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
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
    return (
      <div className="console-panel" style={{ padding: 14 }}>
        <div className="console-section-title" style={{ marginBottom: 6 }}>Asset Inspector</div>
        <div style={{ fontSize: 12, color: '#8B97A3', lineHeight: 1.5 }}>
          Select a transmission line, substation, generator, or building in the
          city to see its live status and what it means.
        </div>
      </div>
    );
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
      zoneStatus?.state === 'Blackout' ? 'critical' : zoneStatus?.state === 'Degraded' ? 'warning' : 'nominal';
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
            tone={zoneStatus && (zoneStatus.unservedLoad as number) > 0 ? TONE_COLOR['critical'] : undefined}
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

  return (
    <div className="console-panel" style={{ padding: 14, overflowY: 'auto', maxHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
        <div>
          <div className="console-value" style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
          <div style={{ fontSize: 11, color: '#8B97A3' }}>{subtitle}</div>
        </div>
        <button
          className="console-btn"
          style={{ padding: '2px 8px', fontSize: 11, lineHeight: 1.4 }}
          onClick={close}
          aria-label="Close inspector"
        >
          ✕
        </button>
      </div>
      <div style={{ borderTop: '1px solid #D3D7D2', margin: '8px 0 10px' }} />
      {body}
    </div>
  );
}
