import { useEffect, useState } from 'react';
import { useSimulationStore } from '@state';
import type { ReactElement } from 'react';
import { useRuntime } from '../../runtime-context';
import { LEARNER_TWIN } from '@learning';

export function Hud(): ReactElement | null {
  const activeDecision = useSimulationStore((s) => s.activeDecision);
  const runtime = useRuntime();
  const [advisorResponse, setAdvisorResponse] = useState<any>(null);
  const [loadingAdvisor, setLoadingAdvisor] = useState(false);
  const [twinState, setTwinState] = useState<any>(null);

  // Poll the twin state
  useEffect(() => {
    const twin = runtime.container.resolve(LEARNER_TWIN);
    if (!twin || !twin.state) return;
    
    const interval = setInterval(() => {
      try {
        setTwinState(twin.state());
      } catch {
        // ignore
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [runtime]);

  useEffect(() => {
    if (!activeDecision) {
      setAdvisorResponse(null);
      return;
    }

    setLoadingAdvisor(true);
    let isMounted = true;

    // Simulate AI Advisor call with Gemini (Placeholder for actual fetch)
    // We wrap it in a timeout of 2.5s per PRD
    const fetchAdvisor = async () => {
      try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 2500);

        // Here you would make a real fetch to Gemini API
        // For demonstration without an actual API key, we simulate network latency and return fallback
        await new Promise(r => setTimeout(r, 1000));
        
        if (!isMounted) return;
        setAdvisorResponse({
          suggestion: `Consider shedding non-critical load immediately in ${activeDecision.options[0]}.`,
          reason: "Prioritizing critical infrastructure is essential during peak stress.",
          confidence: 0.85,
          tone: "urgent"
        });
      } catch (err) {
        if (!isMounted) return;
        // Static fallback
        setAdvisorResponse({
          suggestion: "Shed non-critical load.",
          reason: "Static fallback engaged due to timeout.",
          confidence: 1.0,
          tone: "neutral"
        });
      } finally {
        if (isMounted) setLoadingAdvisor(false);
      }
    };

    fetchAdvisor();

    return () => {
      isMounted = false;
    };
  }, [activeDecision]);

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex flex-col justify-between p-6">
      {/* Top HUD: Learner Twin State */}
      <div className="flex justify-between items-start">
        <div className="bg-[#111827]/80 backdrop-blur-md border border-emerald-500/30 rounded-xl p-4 shadow-lg w-72">
          <h3 className="text-emerald-400 font-bold mb-2 text-sm uppercase tracking-wider">Learner Twin</h3>
          {twinState ? (
            <div className="text-slate-200 text-xs flex flex-col gap-1">
              <div className="flex justify-between"><span>Decisions:</span> <span className="font-mono text-emerald-300">{twinState.decisions_made}</span></div>
              <div className="flex justify-between"><span>Optimal:</span> <span className="font-mono text-emerald-300">{twinState.correct_tradeoff_decisions}</span></div>
              <div className="flex justify-between"><span>Avg Time:</span> <span className="font-mono text-emerald-300">{twinState.avg_decision_time_sec.toFixed(1)}s</span></div>
              <div className="flex justify-between"><span>Mastery:</span> <span className="font-mono text-emerald-300">{(twinState.understanding_score * 100).toFixed(0)}%</span></div>
            </div>
          ) : (
            <div className="text-slate-400 text-xs">Waiting for twin state...</div>
          )}
        </div>
      </div>

      {/* Bottom HUD: AI Advisor */}
      {activeDecision && (
        <div className="flex justify-center mb-10">
          <div className="bg-[#0f172a]/90 backdrop-blur-xl border-l-4 border-l-indigo-500 rounded-r-xl p-5 shadow-2xl max-w-2xl w-full">
            <h3 className="text-indigo-400 font-bold mb-1 text-sm uppercase flex items-center gap-2">
              🤖 AI Advisor {loadingAdvisor && <span className="animate-pulse text-indigo-300">Analyzing...</span>}
            </h3>
            {advisorResponse ? (
              <div>
                <p className="text-white text-lg font-medium mb-1">{advisorResponse.suggestion}</p>
                <p className="text-indigo-200 text-sm">{advisorResponse.reason}</p>
              </div>
            ) : (
              <div className="h-12 flex items-center">
                <div className="w-full bg-slate-700/50 h-2 rounded overflow-hidden">
                  <div className="bg-indigo-500 h-full animate-[pulse_1.5s_ease-in-out_infinite]" style={{ width: '60%' }}></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
