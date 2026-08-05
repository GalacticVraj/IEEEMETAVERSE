/**
 * SelectionChip — a compact label anchored to the selected asset IN THE WORLD.
 *
 * The other half of the left/right fix: when you click a building, the answer
 * begins at the building itself rather than at the far edge of the screen. The
 * chip is deliberately tiny — identity, status, one live number — and points
 * at the rail for the depth. It never becomes a second inspector.
 *
 * Lives in `rendering/` because it is anchored in world space and must sit
 * inside the <Canvas> tree to project correctly. It reads projections only
 * (ui-store selection, grid-store telemetry) and static topology — it computes
 * no simulation state, exactly like every other component here.
 */
import { MERIDIAN_BAY_TOPOLOGY } from '@engine/topology/meridian-bay';
import { Html } from '@react-three/drei';
import { useGridStore, useUiStore } from '@state';
import type { ReactElement } from 'react';

import { buildingNote, zoneDisplayName, zoneOfBuilding } from '../ui/console/learning-copy';

import { buildingPosition3 } from './camera/city-positions';
import { BUS_POSITIONS } from './layout';

const TONE_COLOR: Record<string, string> = {
  nominal: '#217A56',
  caution: '#9A6B15',
  warning: '#B4531F',
  critical: '#B3261E',
  offline: '#5F6B76',
};

/** How far above the anchor the chip floats, per asset kind (world units). */
const LIFT = { building: 24, bus: 26, generator: 26, line: 18 } as const;

/** Display thresholds — mirror the console's corridor-stress colouring. */
const STRESSED_PCT = 80;
const OVERLOADED_PCT = 100;

/** Strictly below the console's zIndex 20 — a chip must never cover a panel. */
const CHIP_Z_TOP = 15;

type Anchor = readonly [number, number, number];

function anchorFor(kind: string, id: string): Anchor | null {
  if (kind === 'building') {
    const at = buildingPosition3(id);
    return at === null ? null : [at[0], at[1] + LIFT.building, at[2]];
  }

  if (kind === 'bus') {
    const at = BUS_POSITIONS[id];
    return at === undefined ? null : [at[0], LIFT.bus, at[1]];
  }

  if (kind === 'generator') {
    const generator = MERIDIAN_BAY_TOPOLOGY.generators.find((g) => (g.id as string) === id);
    const at = generator === undefined ? undefined : BUS_POSITIONS[generator.node as string];
    return at === undefined ? null : [at[0], LIFT.generator, at[1]];
  }

  // Line — float above the corridor midpoint.
  const line = MERIDIAN_BAY_TOPOLOGY.lines.find((l) => (l.id as string) === id);
  if (line === undefined) return null;
  const from = BUS_POSITIONS[line.from as string];
  const to = BUS_POSITIONS[line.to as string];
  if (from === undefined || to === undefined) return null;
  return [(from[0] + to[0]) / 2, LIFT.line, (from[1] + to[1]) / 2];
}

interface ChipContent {
  readonly title: string;
  readonly status: string;
  readonly tone: string;
  readonly metric: string;
}

export function SelectionChip(): ReactElement | null {
  const selected = useUiStore((s) => s.selectedAsset);
  const lines = useGridStore((s) => s.lines);
  const zones = useGridStore((s) => s.zones);
  const generators = useGridStore((s) => s.generators);

  if (selected === null) return null;

  const anchor = anchorFor(selected.kind, selected.id);
  if (anchor === null) return null;

  let content: ChipContent;

  if (selected.kind === 'line') {
    const topo = MERIDIAN_BAY_TOPOLOGY.lines.find((l) => (l.id as string) === selected.id);
    const flow = lines.find((f) => (f.line as string) === selected.id);
    const loading = flow === undefined ? 0 : Math.round((flow.loading as number) * 100);
    const open = flow?.state === 'Tripped';
    content = {
      title: selected.id,
      status: open
        ? 'TRIPPED'
        : loading >= OVERLOADED_PCT
          ? 'OVERLOADED'
          : loading >= STRESSED_PCT
            ? 'STRESSED'
            : 'NOMINAL',
      tone:
        open || loading >= OVERLOADED_PCT
          ? 'critical'
          : loading >= STRESSED_PCT
            ? 'warning'
            : 'nominal',
      metric:
        flow === undefined
          ? '—'
          : `${loading}% of ${topo?.capacity ?? '—'} MW · ${Math.abs(Math.round(flow.flow))} MW flowing`,
    };
  } else if (selected.kind === 'generator') {
    const topo = MERIDIAN_BAY_TOPOLOGY.generators.find((g) => (g.id as string) === selected.id);
    const live = generators.find((g) => (g.id as string) === selected.id);
    const tripped = live?.tripped ?? false;
    content = {
      title: selected.id,
      status: tripped ? 'TRIPPED' : 'ONLINE',
      tone: tripped ? 'critical' : 'nominal',
      metric: live ? `${Math.round(live.outputMw)} MW of ${topo?.capacity ?? '—'} MW` : '—',
    };
  } else if (selected.kind === 'bus') {
    const node = MERIDIAN_BAY_TOPOLOGY.nodes.find((n) => (n.id as string) === selected.id);
    const zoneId = (node?.zone as string) ?? '';
    const zone = zones.find((z) => (z.zone as string) === zoneId);
    const dark = zone?.state === 'Blackout';
    content = {
      title: selected.id,
      status: zone?.state?.toUpperCase() ?? 'POWERED',
      tone: dark ? 'critical' : zone?.state === 'Degraded' ? 'warning' : 'nominal',
      metric: zone ? `${zoneDisplayName(zoneId)} · ${Math.round(zone.servedLoad)} MW served` : '—',
    };
  } else {
    const info = buildingNote(selected.id);
    const zoneId = zoneOfBuilding(selected.id);
    const zone = zones.find((z) => (z.zone as string) === zoneId);
    const dark = zone?.state === 'Blackout';
    content = {
      title: info.name,
      status: dark ? 'BLACKOUT' : 'POWERED',
      tone: dark ? 'critical' : 'nominal',
      metric: `Tier ${info.priorityTier} · ${info.priorityLabel}`,
    };
  }

  const color = TONE_COLOR[content.tone] ?? TONE_COLOR['offline']!;

  return (
    <Html
      position={anchor}
      center
      occlude={false}
      zIndexRange={[CHIP_Z_TOP, 0]}
      // Purely a label: never intercept a click meant for another building.
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{
          width: 186,
          background: '#FBFCFB',
          border: '1px solid #D3D7D2',
          borderLeft: `3px solid ${color}`,
          borderRadius: 2,
          padding: '6px 9px',
          boxShadow: '0 2px 8px rgba(28, 37, 48, 0.16)',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div
          className="console-value"
          style={{ fontSize: 11.5, fontWeight: 600, color: '#1C2530', lineHeight: 1.3 }}
        >
          {content.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '2px 0 1px' }}>
          <span
            style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }}
          />
          <span
            className="console-value"
            style={{ fontSize: 9.5, fontWeight: 600, color, letterSpacing: '0.05em' }}
          >
            {content.status}
          </span>
        </div>
        <div
          className="console-value"
          style={{ fontSize: 9.5, color: '#5A6774', lineHeight: 1.35 }}
        >
          {content.metric}
        </div>
        <div style={{ fontSize: 9, color: '#8B97A3', marginTop: 3 }}>▸ details in the rail</div>

        {/* Tail pointing back down at the asset it describes. */}
        <div
          style={{
            position: 'absolute',
            bottom: -6,
            left: '50%',
            marginLeft: -5,
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '6px solid #D3D7D2',
          }}
        />
      </div>
    </Html>
  );
}
