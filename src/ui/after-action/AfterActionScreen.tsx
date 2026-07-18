/**
 * AfterActionScreen.tsx — Section 1.5: After-Action + Advisor.
 *
 * Shows post-crisis results, decision log summary, and the
 * "Ask the Advisor" button for post-mortem analysis via the serverless proxy.
 */
import { useState, type ReactElement } from 'react';
import { useAppFlowStore } from '../../state/app-flow-store';

export function AfterActionScreen(): ReactElement {
  const crisisResult = useAppFlowStore((s) => s.crisisResult);
  const decisionLog = useAppFlowStore((s) => s.decisionLog);
  const postmortemNarrative = useAppFlowStore((s) => s.postmortemNarrative);
  const setPostmortem = useAppFlowStore((s) => s.setPostmortem);
  const replay = useAppFlowStore((s) => s.replay);
  const [loading, setLoading] = useState(false);

  const isSuccess = crisisResult === 'success';

  const handleAskAdvisor = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'postmortem',
          gridState: { loadPct: 0, zoneAtRisk: 'none' },
          twinState: { blackoutsCaused: isSuccess ? 0 : 1, conceptMastery: {} },
          decisionLog,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Try to extract text from Gemini response
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        setPostmortem(text || 'The advisor could not generate a response at this time.');
      } else {
        // Fallback narrative
        setPostmortem(
          `You made ${decisionLog.length} decision(s) during this crisis. ` +
          `${isSuccess ? 'You successfully prevented a full blackout — great work!' : 'The grid experienced a blackout, but every failure is a learning opportunity.'} ` +
          `Consider how load-shedding decisions affected different income zones. ` +
          `Next time, prioritize critical loads like the hospital and check if lower-income zones bore a disproportionate burden. ` +
          `Tip: Activate solar generation early — it takes time to ramp up.`
        );
      }
    } catch {
      setPostmortem(
        'The AI Advisor is currently unavailable. Review your decision log above and consider: ' +
        'were critical loads (hospital) always protected? Were low-income zones treated equitably?'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-auto">
      <div className="absolute inset-0" style={{ background: 'rgba(10, 31, 20, 0.7)', backdropFilter: 'blur(6px)' }} />

      <div className="relative z-10 w-full max-w-2xl px-6 animate-fade-in-up">
        <div className="glass-panel-solid p-8">
          {/* Result header */}
          <div className="text-center mb-6">
            <div style={{ fontSize: 48, marginBottom: 8 }}>
              {isSuccess ? '🌿' : '⚡'}
            </div>
            <h2
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: 32,
                color: isSuccess ? '#74C69D' : '#E63946',
              }}
            >
              {isSuccess ? 'Crisis Resolved' : 'Blackout Occurred'}
            </h2>
            <p style={{ color: 'rgba(216, 243, 220, 0.6)', fontSize: 14, marginTop: 8 }}>
              {isSuccess
                ? 'You kept the lights on for Meridian Bay. But could you have done it more equitably?'
                : 'Parts of Meridian Bay went dark. Let\'s understand what happened.'}
            </p>
          </div>

          {/* Decision summary */}
          <div className="mb-6">
            <h3 style={{ color: '#D8F3DC', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
              Decision Log ({decisionLog.length} actions)
            </h3>
            <div
              className="rounded-lg overflow-auto"
              style={{ maxHeight: 140, background: 'rgba(27, 67, 50, 0.3)', border: '1px solid rgba(116, 198, 157, 0.15)' }}
            >
              {decisionLog.length > 0 ? (
                decisionLog.map((entry, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 flex gap-3 text-xs"
                    style={{ borderBottom: '1px solid rgba(116, 198, 157, 0.1)' }}
                  >
                    <span style={{ color: '#74C69D', fontWeight: 600, minWidth: 20 }}>#{i + 1}</span>
                    <span style={{ color: '#D8F3DC' }}>{entry.action}</span>
                    <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>{entry.zone}</span>
                  </div>
                ))
              ) : (
                <div className="px-3 py-4 text-xs text-center" style={{ color: '#94a3b8' }}>
                  No decisions recorded during this crisis.
                </div>
              )}
            </div>
          </div>

          {/* AI Advisor Section */}
          {!postmortemNarrative ? (
            <button
              onClick={handleAskAdvisor}
              disabled={loading}
              className="btn-outline w-full mb-4"
              style={{ opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {loading ? (
                <>
                  <span className="animate-spin" style={{ display: 'inline-block' }}>⏳</span>
                  Analyzing your decisions...
                </>
              ) : (
                <>🤖 Ask the Advisor What I Could Have Done</>
              )}
            </button>
          ) : (
            <div
              className="rounded-lg p-4 mb-4"
              style={{ background: 'rgba(45, 106, 79, 0.15)', border: '1px solid rgba(116, 198, 157, 0.25)' }}
            >
              <h4 style={{ color: '#74C69D', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                🤖 AI Advisor — Post-Mortem
              </h4>
              <p style={{ color: 'rgba(216, 243, 220, 0.85)', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {postmortemNarrative}
              </p>
            </div>
          )}

          {/* Replay button */}
          <button
            onClick={replay}
            className="btn-moss w-full"
          >
            🔄 Try Another Crisis
          </button>
        </div>
      </div>
    </div>
  );
}
