/**
 * advisor-client.ts — client for the Gemini proxy (/api/advisor).
 *
 * Deterministic-first contract: callers ALWAYS have local, evidence-grounded
 * text; this client only asks Gemini to REWRITE that evidence into a warmer
 * narrative. Any failure (offline, no key, timeout, bad response) returns
 * null and the deterministic text stands. The context sent is compact and
 * contains only measured facts.
 */

export interface AdvisorScoreContext {
  readonly label: string;
  readonly score: number;
  readonly reason: string;
}

export interface AdvisorMomentContext {
  /** Real sim clock label, e.g. "T+00:41". */
  readonly t: string;
  readonly title: string;
  readonly detail: string;
}

export interface AdvisorDecisionContext {
  readonly label: string;
  readonly t: string;
  readonly verdict: string;
  /** Peak corridor stress before/after, percent. */
  readonly stressBeforePct: number;
  readonly stressAfterPct: number | null;
}

export interface AdvisorMasteryContext {
  readonly concept: string;
  readonly masteryPct: number;
  readonly evidenceCount: number;
}

export interface AdvisorContext {
  readonly outcome: string;
  readonly scenario: string;
  readonly stats: {
    readonly peakDemandMw: number;
    readonly worstBalanceMw: number;
    readonly unservedMwS: number;
    readonly peakCorridorStressPct: number;
    readonly renewableSharePct: number;
    readonly lineTrips: number;
    readonly zonesDarkened: readonly string[];
    readonly recoverySeconds: number | null;
  };
  readonly scores: readonly AdvisorScoreContext[];
  readonly moments: readonly AdvisorMomentContext[];
  readonly decisions: readonly AdvisorDecisionContext[];
  readonly mastery: readonly AdvisorMasteryContext[];
}

const TIMEOUT_MS = 6000;

/**
 * Ask Gemini (via the proxy) to rewrite the evidence into a narrative.
 * Returns null on ANY failure — the deterministic narrative remains.
 */
export async function requestAdvisorNarrative(context: AdvisorContext): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch('/api/advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'postmortem', context }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    const text = (
      data as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      }
    ).candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string' || text.trim().length === 0) return null;
    return text.trim();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
