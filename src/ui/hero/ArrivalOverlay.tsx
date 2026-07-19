import type { ReactElement } from 'react';
import { useAppFlowStore } from '../../state/app-flow-store';

export function ArrivalOverlay(): ReactElement {
  const finishArrival = useAppFlowStore((s) => s.finishArrival);

  return (
    <div className="absolute inset-0 z-30 pointer-events-none flex justify-end items-end p-8">
      <button
        onClick={finishArrival}
        className="pointer-events-auto text-white/50 hover:text-white/90 transition-colors text-sm uppercase tracking-widest font-medium"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        Skip sequence ⏭
      </button>
    </div>
  );
}
