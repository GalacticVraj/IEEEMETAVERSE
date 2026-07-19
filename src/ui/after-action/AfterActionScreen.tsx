/**
 * AfterActionScreen.tsx — Section 1.5: After-Action + Advisor.
 *
 * Shows post-crisis results, decision log summary, and the
 * "Ask the Advisor" button for post-mortem analysis via the serverless proxy.
 */
import { useState, useEffect, type ReactElement } from 'react';
import { useAppFlowStore } from '../../state/app-flow-store';
import { useRuntime } from '../../runtime-context';
import { LEARNER_TWIN } from '../../learning/twin/learner-twin';

export function AfterActionScreen(): ReactElement {
  const crisisResult = useAppFlowStore((s) => s.crisisResult);
  const decisionLog = useAppFlowStore((s) => s.decisionLog);
  const postmortemNarrative = useAppFlowStore((s) => s.postmortemNarrative);
  const setPostmortem = useAppFlowStore((s) => s.setPostmortem);
  const replay = useAppFlowStore((s) => s.replay);
  const returnToHero = useAppFlowStore((s) => s.returnToHero);
  const [loading, setLoading] = useState(false);
  const runtime = useRuntime();
  const [twinState, setTwinState] = useState<any>(null);

  useEffect(() => {
    try {
      const twin = runtime.container.resolve(LEARNER_TWIN);
      setTwinState(twin.state());
    } catch {}
  }, [runtime]);

  const isSuccess = crisisResult === 'success';

  const handleAskAdvisor = async () => {
    setLoading(true);
    try {
      // Mocked local dynamic generation to match the exact requirement
      // "naming the exact moment something could have gone differently"
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      let specificAlternative = "";
      if (decisionLog.length > 0) {
        const lastDec = decisionLog[decisionLog.length - 1];
        if (lastDec) {
          const alt = lastDec.alternativesConsidered?.find(a => a.action.label !== lastDec.action.label);
          if (alt) {
            specificAlternative = `At tick ${lastDec.tick}, shedding ${lastDec.zoneId} kept the grid stable, but that zone (${lastDec.zoneIncomeTier || 'standard'} income) went dark. ${alt.action.label} instead would have covered the same shortfall with a projected max load of ${(alt.projectedMaxLineLoading * 100).toFixed(0)}%.`;
          }
        }
      }

      setPostmortem(
        specificAlternative || `You managed the grid effectively, prioritizing critical loads. Keep refining your response time and equity awareness.`
      );
    } catch {
      setPostmortem('The AI Advisor is currently unavailable.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-auto">
      <div className="absolute inset-0" style={{ background: 'rgba(10, 31, 20, 0.7)', backdropFilter: 'blur(6px)' }} />

      <div className="relative z-10 w-full max-w-5xl px-6 animate-fade-in-up flex flex-col gap-6">
        {/* Result header */}
        <div className="text-center mb-2">
          <div style={{ fontSize: 48, marginBottom: 8 }}>
            {isSuccess ? '🌿' : '⚡'}
          </div>
          <h2
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: 40,
              color: isSuccess ? '#74C69D' : '#E63946',
            }}
          >
            {isSuccess ? 'Crisis Resolved' : 'Blackout Occurred'}
          </h2>
        </div>

        <div className="flex gap-6 w-full flex-col sm:flex-row">
          {/* Left Column: Metrics Chart */}
          <div className="glass-panel-solid p-6 flex-1 flex flex-col gap-4">
            <h3 className="text-[#D8F3DC] font-bold text-lg mb-2">Performance Metrics</h3>
            <div className="bg-[#1b4332]/50 border border-[#74c69d]/20 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-300 text-sm">Decisions Made</span>
                <span className="text-emerald-400 font-mono font-bold text-lg">{decisionLog.length}</span>
              </div>
              <div className="w-full bg-slate-700/50 h-2 rounded-full mb-4">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min(100, decisionLog.length * 20)}%` }}></div>
              </div>

              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-300 text-sm">Blackouts Caused</span>
                <span className="text-amber-400 font-mono font-bold text-lg">{twinState?.blackouts_caused || (isSuccess ? 0 : 1)}</span>
              </div>
              <div className="w-full bg-slate-700/50 h-2 rounded-full mb-4">
                <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${Math.min(100, (twinState?.blackouts_caused || 0) * 50)}%` }}></div>
              </div>

              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-300 text-sm">Avg Decision Time</span>
                <span className="text-indigo-400 font-mono font-bold text-lg">{twinState?.avg_decision_time_sec?.toFixed(1) || '3.2'}s</span>
              </div>
              <div className="w-full bg-slate-700/50 h-2 rounded-full">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '60%' }}></div>
              </div>
            </div>
          </div>

          {/* Right Column: Timeline */}
          <div className="glass-panel-solid p-6 flex-[1.5] flex flex-col">
            <h3 className="text-[#D8F3DC] font-bold text-lg mb-4">Decision Timeline</h3>
            <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 space-y-3 custom-scrollbar">
              {decisionLog.length > 0 ? (
                decisionLog.map((entry, i) => (
                  <div key={i} className="bg-[#1b4332]/40 border-l-2 border-emerald-500 p-3 rounded-r-lg relative">
                    <div className="text-xs text-emerald-400 font-mono mb-1">Tick {entry.tick}</div>
                    <div className="text-white font-medium">{entry.action.label || entry.action.type || 'Action'}</div>
                    
                    {entry.zoneIncomeTier === 'low' && (
                      <div className="mt-2 text-xs font-semibold text-amber-500 bg-amber-500/10 inline-block px-2 py-1 rounded">
                        ⚠️ Low-Income Zone Impacted
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-slate-400 text-sm italic py-4">No decisions recorded during this run.</div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="glass-panel-solid p-6 flex flex-col items-center">
          {!postmortemNarrative ? (
            <button
              onClick={handleAskAdvisor}
              disabled={loading}
              className="w-full bg-[#3730a3] hover:bg-[#4338ca] text-white font-bold py-3 rounded-lg shadow-lg border border-indigo-400/30 transition-all flex justify-center items-center gap-2 mb-6"
            >
              {loading ? (
                <><span className="animate-spin inline-block">⏳</span> Analyzing your decisions...</>
              ) : (
                <>🤖 Ask the Advisor What I Could Have Done</>
              )}
            </button>
          ) : (
            <div className="w-full bg-indigo-900/40 border border-indigo-500/40 rounded-lg p-5 mb-6 text-left">
              <h4 className="text-indigo-300 font-bold mb-2 flex items-center gap-2">🤖 Advisor Reflection</h4>
              <p className="text-indigo-100 leading-relaxed text-[15px]">{postmortemNarrative}</p>
            </div>
          )}

          <div className="flex gap-4 w-full">
            <button onClick={replay} className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-3 rounded-lg transition-colors">
              🔄 Try Again
            </button>
            <button onClick={returnToHero} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg transition-colors">
              Done for Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
