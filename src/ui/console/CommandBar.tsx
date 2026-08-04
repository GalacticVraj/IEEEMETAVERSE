/**
 * CommandBar — top operations header: identity, scenario, sim clock, grid
 * stability chip, playback control. All values from projections; the stability
 * label is a pure DISPLAY mapping of live telemetry (no logic feeds back).
 */
import { AppMode, CRISIS_CARDS, useAppFlowStore, useGridStore, useSimulationStore } from '@state';
import type { ReactElement } from 'react';

import { useRuntime } from '../../runtime-context';
import { Tooltip } from '../common/Tooltip';
import { dayPhase, simClock } from './learning-copy';

type Stability = 'NORMAL' | 'ELEVATED' | 'EMERGENCY' | 'BLACKOUT';

const STABILITY_STYLE: Record<Stability, { color: string; bg: string }> = {
  NORMAL: { color: '#217A56', bg: 'rgba(33, 122, 86, 0.10)' },
  ELEVATED: { color: '#9A6B15', bg: 'rgba(154, 107, 21, 0.10)' },
  EMERGENCY: { color: '#B4531F', bg: 'rgba(180, 83, 31, 0.12)' },
  BLACKOUT: { color: '#B3261E', bg: 'rgba(179, 38, 30, 0.12)' },
};

const STABILITY_TOOLTIP: Record<Stability, string> = {
  NORMAL: 'Grid operating within safe limits. Corridor loading is below 80% and frequency is nominal at 60.00 Hz.',
  ELEVATED: 'Corridor loading exceeds 80% or supply deficit exceeds 40 MW. Monitor corridors closely for trip risks.',
  EMERGENCY: 'Critical overload! Line tripped or corridor at 100%. Execute operator actions immediately to avoid cascade blackout.',
  BLACKOUT: 'One or more city districts have lost power. Reconnect transmission lines to restore power to affected homes.',
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

function ShieldIcon(): ReactElement {
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
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
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
        padding: '0 20px',
        borderRadius: '0 0 8px 8px',
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
        height: '48px',
        background: 'rgba(250, 250, 247, 0.96)',
      }}
    >
      {/* Identity + scenario */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: '#22637E',
              color: '#FAFAF7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldIcon />
          </div>
          <span
            className="console-value"
            style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: '#1C2530' }}
          >
            GRIDGUARD
          </span>
        </div>
        <span style={{ color: '#D3D7D2', fontWeight: 300 }}>|</span>
        <span className="console-section-title" style={{ fontSize: 11, color: '#5A6774' }}>
          MERIDIAN BAY OPERATIONS
        </span>
        {scenarioName !== null && (
          <>
            <span style={{ color: '#D3D7D2', fontWeight: 300 }}>|</span>
            <span style={{ fontSize: 12, color: '#22637E', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {scenarioName}
            </span>
          </>
        )}
      </div>

      {/* Sim clock */}
      <Tooltip
        title="Simulation Time & Day Phase"
        content="Tracks real physics elapsed time and heatwave diurnal curve."
        position="bottom"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(28, 37, 48, 0.04)',
            padding: '4px 12px',
            borderRadius: 6,
            cursor: 'help',
          }}
        >
          <span
            className="console-value"
            style={{ fontSize: 14, fontWeight: 700, color: '#1C2530' }}
          >
            {simClock(tick)}
          </span>
          <span style={{ fontSize: 11, color: '#5A6774', fontWeight: 500 }}>{dayPhase(tick)}</span>
        </div>
      </Tooltip>

      {/* Status + controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Tooltip
          title={`Grid State: ${stability}`}
          content={STABILITY_TOOLTIP[stability]}
          position="bottom"
        >
          <span
            className="console-value"
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: style.color,
              background: style.bg,
              border: `1px solid ${style.color}`,
              borderRadius: 6,
              padding: '4px 12px',
              letterSpacing: '0.06em',
              cursor: 'help',
            }}
          >
            ● {active ? stability : 'STANDBY'}
          </span>
        </Tooltip>
        {active && (
          <>
            <Tooltip
              title={paused ? 'Resume Simulation Engine' : 'Pause Simulation Engine'}
              content={
                paused
                  ? 'Resumes real-time clock advancement and physics solver. Shortcut: SPACE'
                  : 'Freezes simulation clock and physics ticks. Allows inspecting network status without time pressure. Shortcut: SPACE'
              }
              position="bottom"
            >
              <button
                className="console-btn"
                onClick={() => (paused ? runtime.session.resume() : runtime.session.pause())}
              >
                {paused ? '▶ Resume' : '⏸ Pause'}
              </button>
            </Tooltip>
            <Tooltip
              title="End Shift Early"
              content="Concludes the active scenario run and opens the evidence-based After-Action review with measured score."
              position="bottom"
            >
              <button className="console-btn" onClick={endShift}>
                End Shift
              </button>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
