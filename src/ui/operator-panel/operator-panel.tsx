/**
 * OperatorPanel — the minimal HUD overlay for the vertical slice.
 *
 * Displays:
 *   - Current tick
 *   - Active scenario
 *   - Total load / generation (MW)
 *   - Number of tripped lines
 *   - Play / Pause / Reset buttons
 *
 * Reads from useGridStore and useSimulationStore. Controls the kernel via
 * the RuntimeContext. No simulation logic runs here.
 */
import { KernelState } from '@app-types';
import { useGridStore, useSimulationStore } from '@state';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRuntime } from '../../runtime-context';
import { useAppFlowStore, type AppFlowState } from '../../state/app-flow-store';

/** Interval between kernel ticks in ms (10 ticks/s → ~real-time). */
const TICK_INTERVAL_MS = 100;
/** Max crisis duration: 3 minutes at 10 ticks/s = 1800 ticks. */
const MAX_TICKS = 1800;

export function OperatorPanel(): JSX.Element {
  const runtime = useRuntime();
  const { kernel } = runtime;

  const tick = useGridStore((s) => s.tick);
  const totalLoad = useGridStore((s) => s.totalLoad);
  const totalGeneration = useGridStore((s) => s.totalGeneration);
  const trippedCount = useGridStore((s) => s.trippedCount);
  const openLines = useGridStore((s) => s.openLines);
  const lifecycle = useSimulationStore((s) => s.lifecycle);

  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startLoop = useCallback(() => {
    if (intervalRef.current !== null) return;
    // Transition kernel to Running if it's Idle
    try {
      if (kernel.state === KernelState.Idle) kernel.start();
      else if (kernel.state === KernelState.Paused) kernel.resume();
    } catch { /* already running */ }
    intervalRef.current = setInterval(() => {
      try { kernel.tick(); } catch { /* kernel not ready */ }
    }, TICK_INTERVAL_MS);
    setRunning(true);
  }, [kernel]);

  const pauseLoop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    try { kernel.pause(); } catch { /* ignore */ }
    setRunning(false);
  }, [kernel]);

  const resetLoop = useCallback(() => {
    pauseLoop();
    try { kernel.reset(); } catch { /* ignore */ }
  }, [kernel, pauseLoop]);

  // On Mount: reset the kernel and start it cleanly
  useEffect(() => {
    resetLoop();
    startLoop();
    return () => {
      pauseLoop();
    };
  }, []);

  const resolveCrisis = useAppFlowStore((s: AppFlowState) => s.resolveCrisis);

  // Monitor for simulation end conditions
  useEffect(() => {
    if (tick >= MAX_TICKS) {
      pauseLoop();
      resolveCrisis('success');
    } else if (trippedCount >= 3) {
      pauseLoop();
      resolveCrisis('blackout');
    }
  }, [tick, trippedCount, pauseLoop, resolveCrisis]);

  const openList = [...openLines].join(', ') || 'none';
  const selectedCrisis = useAppFlowStore((s: AppFlowState) => s.selectedCrisis);
  
  // Assuming 10 ticks = 1 second. Max time 3 minutes (180s) = 1800 ticks
  const ticksRemaining = Math.max(0, MAX_TICKS - tick);
  const secondsRemaining = Math.floor(ticksRemaining / 10);
  const mins = Math.floor(secondsRemaining / 60);
  const secs = (secondsRemaining % 60).toString().padStart(2, '0');

  return (
    <>
      {/* Crisis Banner */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 mt-4 z-50 animate-slide-down pointer-events-none">
        <div className="bg-[#111827]/90 backdrop-blur-md border border-red-500/50 rounded-xl px-8 py-3 flex items-center gap-6 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
          <div className="flex flex-col">
            <span className="text-red-500 text-xs font-bold uppercase tracking-widest">Active Crisis</span>
            <span className="text-white font-bold text-lg">{selectedCrisis?.replace('_', ' ').toUpperCase() || 'SYSTEM STRESS'}</span>
          </div>
          <div className="h-8 w-px bg-slate-700"></div>
          <div className="text-3xl font-mono font-bold text-red-400 tabular-nums">
            {mins}:{secs}
          </div>
        </div>
      </div>

      <div style={{
        position: 'fixed',
        top: 16,
        right: 16,
      width: 280,
      background: 'rgba(10, 31, 20, 0.92)',
      border: '1px solid rgba(116, 198, 157, 0.3)',
      borderRadius: 12,
      padding: '16px 18px',
      fontFamily: "'Inter', monospace",
      color: '#D8F3DC',
      fontSize: 13,
      pointerEvents: 'all',
      userSelect: 'none',
      boxShadow: '0 4px 30px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(16px)',
    }}>
      <div style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 12, color: '#74C69D', letterSpacing: 1 }}>
        🌿 GRIDGUARD OPERATOR
      </div>

      <Row label="Tick" value={String(tick)} />
      <Row label="Scenario" value="Heatwave" />
      <Row label="Lifecycle" value={lifecycle} />
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '10px 0' }} />
      <Row label="Total Load" value={`${totalLoad.toFixed(0)} MW`} />
      <Row label="Total Gen" value={`${totalGeneration.toFixed(0)} MW`} />
      <Row
        label="Balance"
        value={`${(totalGeneration - totalLoad).toFixed(0)} MW`}
        highlight={(totalGeneration - totalLoad) < -50 ? '#ef4444' : '#22c55e'}
      />
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '10px 0' }} />
      <Row
        label="Tripped Lines"
        value={String(trippedCount)}
        highlight={trippedCount > 0 ? '#ef4444' : '#22c55e'}
      />

      {trippedCount > 0 && (
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, wordBreak: 'break-all' }}>
          Open: {openList}
        </div>
      )}

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '12px 0 8px' }} />

      {/* Line loading legend */}
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
        Line loading:{' '}
        <span style={{ color: '#22c55e' }}>■ &lt;60%</span>{' '}
        <span style={{ color: '#eab308' }}>■ &lt;80%</span>{' '}
        <span style={{ color: '#f97316' }}>■ &lt;100%</span>{' '}
        <span style={{ color: '#ef4444' }}>■ &gt;100%</span>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <Btn onClick={running ? pauseLoop : startLoop} color="#2D6A4F">
          {running ? '⏸ Pause' : '▶ Play'}
        </Btn>
        <Btn onClick={resetLoop} color="#374151">
          ↺ Reset
        </Btn>
      </div>
    </div>
    </>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: string;
}): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{ color: highlight ?? '#f1f5f9', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function Btn({
  children,
  onClick,
  color,
}: {
  children: React.ReactNode;
  onClick: () => void;
  color: string;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '7px 0',
        background: color,
        border: 'none',
        borderRadius: 6,
        color: 'white',
        fontFamily: 'monospace',
        fontSize: 12,
        cursor: 'pointer',
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}
