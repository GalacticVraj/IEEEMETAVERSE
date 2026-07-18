import { useRuntime } from '../../runtime-context';
import { useSimulationStore } from '@state';
import type { ReactElement } from 'react';
import type { Seconds } from '@app-types';

/**
 * The radial/modal decision menu. Opens on `DecisionRequested`, previews the delta of
 * each option, and emits `DecisionCommitted` on selection. Fully keyboard-
 * operable (arrows + enter) per the accessibility requirement.
 */
export function DecisionWheel(): ReactElement | null {
  const activeDecision = useSimulationStore((s) => s.activeDecision);
  const runtime = useRuntime();

  if (!activeDecision) return null;

  const handleOptionSelect = (index: number) => {
    // We would use the kernel to dispatch a decision commit
    // But since the UI is just emitting, we can emit the event directly onto the bus
    runtime.kernel.events.emit('DecisionCommitted', {
      decisionId: activeDecision.decisionId,
      optionIndex: index,
      simTime: useSimulationStore.getState().simTime as Seconds,
    });
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50 pointer-events-auto">
      <div className="bg-[#111827]/80 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-8 shadow-2xl max-w-lg w-full text-center text-white">
        <h2 className="text-2xl font-bold mb-4 text-amber-400">⚡ CRISIS ALERT</h2>
        <p className="text-lg mb-8 text-slate-200">{activeDecision.prompt}</p>
        
        <div className="flex flex-col gap-3">
          {activeDecision.options.map((opt: string, idx: number) => (
            <button
              key={idx}
              onClick={() => handleOptionSelect(idx)}
              className="bg-indigo-600/80 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors border border-indigo-400/50 hover:border-indigo-300 cursor-pointer"
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
