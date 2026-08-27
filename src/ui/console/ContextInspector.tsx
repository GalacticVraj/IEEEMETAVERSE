/**
 * ContextInspector — left-rail detail for the selected 3D asset.
 *
 * Replaces the old right-rail AssetInspector. The move is the point: the
 * player clicks a building in the city, sees a summary chip at the object
 * itself (`rendering/selection-chip`), and reads the depth HERE — directly
 * above the Operator Actions they would use to respond. Cause sits next to
 * effect instead of at the opposite edge of the screen.
 *
 * Reads ONLY from projections (ui-store selection, grid-store telemetry) and
 * static topology. Every number shown is live simulation output or topology
 * data; explanations come from learning-copy.
 */
import type { LineRestoration } from '@engine';
import { MERIDIAN_BAY_TOPOLOGY } from '@engine/topology/meridian-bay';
import { useGridStore, useUiStore } from '@state';
import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { useRuntime } from '../../runtime-context';

import { commitDecision, recloseDecisionId } from './commit-decision';
import {
  buildingNote,
  estimateHouseholdsAffected,
  explainBus,
  explainGenerator,
  explainLine,
  simClock,
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
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ fontSize: 12, color: '#5A6774' }}>{label}</span>
      <span
        className="console-value"
        style={{ fontSize: 12, color: tone ?? '#1C2530', fontWeight: 600 }}
      >
        {value}
      </span>
    </div>
  );
}

function Teaching({
  cause,
  impact,
  action,
}: {
  cause: string;
  impact: string;
  action: string;
}): ReactElement {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ marginTop: 8, borderTop: '1px solid #E7E9E6', paddingTop: 6 }}>
      <button
        className="console-btn"
        style={{
          padding: '2px 6px',
          fontSize: 10,
          lineHeight: 1.5,
          width: '100%',
          textAlign: 'left',
          border: 'none',
          background: 'transparent',
        }}
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
      >
        <span className="console-section-title">{open ? '▾' : '▸'} Why this matters</span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          {(
            [
              ['Why', cause],
              ['Impact', impact],
              ['Recommended', action],
            ] as const
          ).map(([title, text]) => (
            <div key={title}>
              <div className="console-section-title" style={{ fontSize: 10, marginBottom: 2 }}>
                {title}
              </div>
              <div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#1C2530' }}>{text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The reclose control for an open corridor.
 *
 * This is a REQUEST, not a switch. The conductor temperature shown here is the
 * protection engine's own thermal state, and the threshold is the one the
 * automatic controller uses to decide when it will reclose by itself. Below
 * that line the request is routine. Above it the operator can still send it —
 * and the corridor will very likely trip straight back out, one step nearer
 * relay lockout.
 *
 * That refusal-by-physics is the teaching moment, so the button is never
 * disabled. It is labelled honestly and lets the grid answer.
 */
function RestorationControl({ status }: { status: LineRestoration }): ReactElement {
  const runtime = useRuntime();
  const [requestedAt, setRequestedAt] = useState<number | null>(null);

  const temp = Math.round(status.conductorTempC);
  const limit = Math.round(status.recloseBelowC);
  const ready = status.readyToReclose;

  const request = (): void => {
    const { tick } = useGridStore.getState();
    const lineId = status.line as string;
    commitDecision(runtime, recloseDecisionId(lineId, tick), 0, `Reclose ${lineId}`);
    setRequestedAt(tick);
  };

  return (
    <div
      style={{
        marginTop: 8,
        padding: '7px 9px',
        border: `1px solid ${ready ? 'rgba(33, 122, 86, 0.35)' : 'rgba(180, 83, 31, 0.4)'}`,
        background: ready ? 'rgba(33, 122, 86, 0.06)' : 'rgba(180, 83, 31, 0.07)',
        borderRadius: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 11, color: '#5A6774' }}>Conductor</span>
        <span
          className="console-value"
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: ready ? TONE_COLOR['nominal'] : TONE_COLOR['warning'],
          }}
        >
          {temp} °C
        </span>
      </div>
      <div style={{ fontSize: 10.5, lineHeight: 1.4, color: '#5A6774', margin: '3px 0 6px' }}>
        {ready
          ? `Cooled below ${String(limit)} °C. A reclose should hold.`
          : `Still above the ${String(limit)} °C reclose limit. Closing now will almost certainly trip straight back out and move the relay nearer lockout.`}
      </div>
      {requestedAt === null ? (
        <button className="console-btn" style={{ width: '100%', fontSize: 11 }} onClick={request}>
          Request Restoration
        </button>
      ) : (
        <div
          className="console-value"
          style={{ fontSize: 10.5, color: '#22637E', textAlign: 'center' }}
        >
          REQUESTED · {simClock(requestedAt)} — watch the corridor
        </div>
      )}
    </div>
  );
}

export function ContextInspector(): ReactElement | null {
  const selected = useUiStore((s) => s.selectedAsset);
  const selectAsset = useUiStore((s) => s.selectAsset);
  const lines = useGridStore((s) => s.lines);
  const restoration = useGridStore((s) => s.restoration);
  const zones = useGridStore((s) => s.zones);
  const generators = useGridStore((s) => s.generators);
  const cardRef = useRef<HTMLDivElement>(null);

  // If the rail happens to be scrolled down, a newly selected asset would
  // render above the fold and feel like nothing happened. Pull it into view.
  useEffect(() => {
    if (selected !== null)
      cardRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  // Nothing selected → the card simply isn't there. The old right-rail
  // placeholder ("Select a transmission line…") would sit dead in the rail and
  // push the Operator Actions down for no benefit.
  if (selected === null) return null;

  const close = (): void => selectAsset(null);

  let body: ReactElement | null = null;
  let title = selected.id;
  let subtitle = '';
  let statusLabel = '';
  let statusTone = 'offline';

  if (selected.kind === 'line') {
    const topo = MERIDIAN_BAY_TOPOLOGY.lines.find((l) => (l.id as string) === selected.id);
    const flow = lines.find((f) => (f.line as string) === selected.id);
    // A tripped corridor is removed from the electrical graph, so it has no
    // entry in `lines` at all. Its live state lives in the restoration
    // projection instead — which is exactly why an "Open" line used to read as
    // a row of em-dashes with nothing to explain it.
    const open = restoration.find((r) => (r.line as string) === selected.id);
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
    statusLabel = open !== undefined ? 'OPEN — BREAKER TRIPPED' : explanation.statusLabel;
    statusTone = open !== undefined ? 'critical' : explanation.statusTone;
    body = (
      <>
        <MetricRow
          label="Breaker"
          value={open !== undefined ? 'Open' : 'Closed'}
          tone={open !== undefined ? TONE_COLOR['critical'] : TONE_COLOR['nominal']}
        />
        <MetricRow
          label="Flow"
          value={
            open !== undefined
              ? '0 MW — de-energized'
              : flow
                ? `${Math.abs(Math.round(flow.flow))} MW`
                : '—'
          }
        />
        <MetricRow
          label="Loading"
          value={
            open !== undefined
              ? '—'
              : flow
                ? `${Math.round((flow.loading as number) * 100)} %`
                : '—'
          }
          tone={TONE_COLOR[explanation.statusTone]}
        />
        <MetricRow label="Capacity" value={topo ? `${topo.capacity} MW` : '—'} />
        <MetricRow label="Corridor" value={topo ? `${topo.from} → ${topo.to}` : '—'} />
        {open !== undefined && <RestorationControl status={open} />}
        <Teaching
          cause={explanation.cause}
          impact={explanation.impact}
          action={explanation.action}
        />
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
    statusLabel = explanation.statusLabel;
    statusTone = explanation.statusTone;
    body = (
      <>
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
        <Teaching
          cause={explanation.cause}
          impact={explanation.impact}
          action={explanation.action}
        />
      </>
    );
  } else if (selected.kind === 'zone') {
    // The district as a whole — the altitude shedding decisions are made at.
    const zoneStatus = zones.find((z) => (z.zone as string) === selected.id);
    const served = zoneStatus ? (zoneStatus.servedLoad as number) : 0;
    const unserved = zoneStatus ? (zoneStatus.unservedLoad as number) : 0;
    const dark = zoneStatus?.state === 'Blackout';
    const substations = MERIDIAN_BAY_TOPOLOGY.nodes.filter(
      (n) => (n.zone as string) === selected.id,
    );
    const explanation = explainBus(selected.id, zoneStatus);
    title = zoneDisplayName(selected.id);
    subtitle = `District · ${String(substations.length)} substations`;
    statusLabel = zoneStatus?.state?.toUpperCase() ?? 'POWERED';
    statusTone = dark ? 'critical' : zoneStatus?.state === 'Degraded' ? 'warning' : 'nominal';
    body = (
      <>
        <MetricRow label="Load served" value={`${String(Math.round(served))} MW`} />
        <MetricRow
          label="Load unserved"
          value={`${String(Math.round(unserved))} MW`}
          tone={unserved > 0 ? TONE_COLOR['critical'] : undefined}
        />
        {/* The number that makes a MW mean something. Same estimator the
            health panel and the after-action report use — one figure, one
            place it is defined. */}
        <MetricRow
          label="Homes affected"
          value={
            unserved > 0 ? `≈${estimateHouseholdsAffected(unserved).toLocaleString()}` : 'none'
          }
          tone={unserved > 0 ? TONE_COLOR['critical'] : TONE_COLOR['nominal']}
        />
        <MetricRow label="Substations" value={substations.map((n) => n.id).join(', ') || '—'} />
        <Teaching
          cause={explanation.cause}
          impact={explanation.impact}
          action={explanation.action}
        />
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
    statusLabel = zoneStatus?.state?.toUpperCase() ?? 'POWERED';
    statusTone =
      zoneStatus?.state === 'Blackout'
        ? 'critical'
        : zoneStatus?.state === 'Degraded'
          ? 'warning'
          : 'nominal';
    body = (
      <>
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
        <Teaching
          cause={explanation.cause}
          impact={explanation.impact}
          action={explanation.action}
        />
      </>
    );
  } else {
    const info = buildingNote(selected.id);
    const zoneId = zoneOfBuilding(selected.id);
    const zoneStatus = zones.find((z) => (z.zone as string) === zoneId);
    const dark = zoneStatus?.state === 'Blackout';
    title = info.name;
    subtitle = `${info.role} · ${zoneDisplayName(zoneId)}`;
    statusLabel = dark ? 'BLACKOUT' : 'POWERED';
    statusTone = dark ? 'critical' : 'nominal';
    body = (
      <>
        <MetricRow label="Priority tier" value={`${info.priorityTier} — ${info.priorityLabel}`} />
        <Teaching
          cause={info.teachingNote}
          impact={
            dark
              ? `This building is inside a blacked-out zone (${zoneDisplayName(zoneId)}).`
              : `Served by the ${zoneDisplayName(zoneId)} distribution network.`
          }
          action={
            info.equityNote ??
            'Weigh this building’s tier against the districts you could shed instead.'
          }
        />
      </>
    );
  }

  const toneColor = TONE_COLOR[statusTone] ?? TONE_COLOR['offline']!;

  return (
    <div
      ref={cardRef}
      className="console-panel"
      style={{ padding: '10px 14px', borderLeft: `3px solid ${toneColor}` }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="console-section-title" style={{ marginBottom: 2 }}>
            Inspecting
          </div>
          <div className="console-value" style={{ fontSize: 13, fontWeight: 600 }}>
            {title}
          </div>
          <div style={{ fontSize: 10.5, color: '#8B97A3' }}>{subtitle}</div>
        </div>
        <button
          className="console-btn"
          style={{ padding: '1px 7px', fontSize: 10, lineHeight: 1.5 }}
          onClick={close}
          aria-label="Close inspector"
        >
          ✕
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 4px' }}>
        <span className="status-led" style={{ background: toneColor }} />
        <span
          className="console-value"
          style={{ fontSize: 11.5, fontWeight: 600, color: toneColor }}
        >
          {statusLabel}
        </span>
      </div>
      {body}
    </div>
  );
}
