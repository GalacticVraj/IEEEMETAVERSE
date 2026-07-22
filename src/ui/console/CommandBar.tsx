/**
 * CommandBar — top operations header: identity, scenario, sim clock, grid
 * stability chip, playback control. All values from projections; the stability
 * label is a pure DISPLAY mapping of live telemetry (no logic feeds back).
 */
import { AppMode, CRISIS_CARDS, useAppFlowStore, useGridStore, useSimulationStore } from '@state';
import type { ReactElement } from 'react';

import { useRuntime } from '../../runtime-context';

import { dayPhase, simClock } from './learning-copy';

type Stability = 'NORMAL' | 'ELEVATED' | 'EMERGENCY' | 'BLACKOUT';

const STABILITY_STYLE: Record<Stability, { color: string; bg: string }> = {
  NORMAL: { color: '#217A56', bg: 'rgba(33, 122, 86, 0.10)' },
  ELEVATED: { color: '#9A6B15', bg: 'rgba(154, 107, 21, 0.10)' },
  EMERGENCY: { color: '#B4531F', bg: 'rgba(180, 83, 31, 0.12)' },
  BLACKOUT: { color: '#B3261E', bg: 'rgba(179, 38, 30, 0.12)' },
};

/** Pure display mapping — reads telemetry, renders a label. */
function stabilityOf(
  maxLoading: number,
  trippedCount: number,
  darkZones: number,
  deficitMw: number,
): Stability {
  if (darkZones > 0) return 'BLACKOUT';
  if (trippedCount > 0 || maxLoading >= 1.0 || deficitMw >= 150) return 'EMERGENCY';
  if (maxLoading >= 0.8 || deficitMw >= 40) return 'ELEVATED';
  return 'NORMAL';
}

export function CommandBar(): ReactElement {
  const runtime = useRuntime();
  const mode = useAppFlowStore((s) => s.mode);
  const selectedCrisis = useAppFlowStore((s) => s.selectedCrisis);
  const resolveCrisis = useAppFlowStore((s) => s.resolveCrisis);
  const tick = useGridStore((s) => s.tick);
  const trippedCount = useGridStore((s) => s.trippedCount);
  const zones = useGridStore((s) => s.zones);
  const totalLoad = useGridStore((s) => s.totalLoad);
  const totalGeneration = useGridStore((s) => s.totalGeneration);
  const maxLineLoading = useSimulationStore((s) => s.maxLineLoading);
  const lifecycle = useSimulationStore((s) => s.lifecycle);

  const darkZones = zones.filter((z) => z.state === 'Blackout').length;
  const deficitMw = Math.max(0, totalLoad - totalGeneration);
  const stability = stabilityOf(maxLineLoading, trippedCount, darkZones, deficitMw);
  const style = STABILITY_STYLE[stability];
  const active = mode === AppMode.ActiveCrisis;
  const paused = lifecycle === 'Paused';
  const scenarioName = CRISIS_CARDS.find((c) => c.id === selectedCrisis)?.label ?? null;

  const endShift = (): void => {
    runtime.session.stop();
    resolveCrisis(darkZones > 0 ? 'blackout' : 'success');
  };

  return (
    <div
      className="console-panel"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        borderRadius: 0,
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
      }}
    >
      {/* Identity + scenario */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, minWidth: 0 }}>
        <span className="console-value" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em' }}>
          GRIDGUARD · MERIDIAN BAY OPERATIONS
        </span>
        {scenarioName !== null && (
          <span style={{ fontSize: 12, color: '#5A6774', whiteSpace: 'nowrap' }}>{scenarioName}</span>
        )}
      </div>

      {/* Sim clock */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span className="console-value" style={{ fontSize: 14, fontWeight: 600 }}>{simClock(tick)}</span>
        <span style={{ fontSize: 11, color: '#8B97A3' }}>{dayPhase(tick)}</span>
      </div>

      {/* Status + controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          className="console-value"
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: style.color,
            background: style.bg,
            border: `1px solid ${style.color}`,
            borderRadius: 2,
            padding: '3px 10px',
            letterSpacing: '0.06em',
          }}
        >
          {active ? stability : 'STANDBY'}
        </span>
        {active && (
          <>
            <button
              className="console-btn"
              onClick={() => (paused ? runtime.session.resume() : runtime.session.pause())}
            >
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button className="console-btn" onClick={endShift}>
              End Shift
            </button>
          </>
        )}
      </div>
    </div>
  );
}
