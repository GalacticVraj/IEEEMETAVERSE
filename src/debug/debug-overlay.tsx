import type { ReactElement } from 'react';

import { useSimulationStore } from '@state';

export interface DebugOverlayProps {
  readonly seed: number;
}

interface MetricRowProps {
  readonly label: string;
  readonly value: string;
}

function MetricRow({ label, value }: MetricRowProps): ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="text-ink-muted">{label}</span>
      <span className="text-ink-primary tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Developer overlay. Reads ONLY from the simulation projection store — like
 * every consumer, it observes state, it does not compute it. FPS / memory are
 * shown as placeholders until the metrics collector lands.
 */
export function DebugOverlay({ seed }: DebugOverlayProps): ReactElement {
  const tick = useSimulationStore((state) => state.tick);
  const simTime = useSimulationStore((state) => state.simTime);
  const lifecycle = useSimulationStore((state) => state.lifecycle);
  const maxLoading = useSimulationStore((state) => state.maxLineLoading);

  return (
    <aside className="pointer-events-none fixed top-14 right-[336px] z-50 w-64 select-none rounded-instrument border border-surface-border bg-surface-panel/95 p-3 font-mono text-[11px] leading-relaxed text-ink-secondary shadow-lg">
      <div className="mb-2 flex items-center justify-between border-b border-surface-border pb-1 text-instrument">
        <span className="uppercase tracking-widest">GridGuard · Debug</span>
        <span className="text-status-nominal">●</span>
      </div>
      <MetricRow label="seed" value={String(seed)} />
      <MetricRow label="state" value={lifecycle} />
      <MetricRow label="tick" value={String(tick)} />
      <MetricRow label="sim time" value={`${simTime.toFixed(1)}s`} />
      <MetricRow label="max loading" value={maxLoading.toFixed(2)} />
      <MetricRow label="fps" value="—" />
      <MetricRow label="memory" value="—" />
    </aside>
  );
}
