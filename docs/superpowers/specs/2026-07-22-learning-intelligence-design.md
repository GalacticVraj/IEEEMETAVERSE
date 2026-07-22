# §4 Learning Intelligence — Design Spec (approved)

Date: 2026-07-22 · Branch: `vraj` · Depends on: §1–§3

## Objective

Evidence-driven adaptive learning. The AI is a mentor, not a chatbot: every
statement originates from measured simulation evidence. Gemini only REWRITES
grounded material; the deterministic generator produces the same educational
conclusions when Gemini is unreachable. Never invented: timestamps, decisions,
failures, metrics, explanations, recommendations.

## Frozen

Kernel, graph, power flow, protection, camera system, the 7 Mission Control
console components, the event architecture (no new GRID_EVENTs). Simulation
stays deterministic; the AI never changes outcomes.

## Architecture

```
bus events ──► EvidenceEngine (learning/evidence, DI token, bound in bootstrap)
                 pre-snapshot ─ 50-tick window ─ post-snapshot ─ measured effect
                 ├─► LearnerTwin.observeDecision (mastery/confidence/evidence)
                 └─► onRecord → advisor-store (in-play feedback w/ real deltas)
bus events ──► run-stats-store (state) — peak demand, worst balance, unserved
               MW·ticks, blackout spans → recovery, renewable share, trips
run end    ──► scoreRun (learning/scoring, pure) — 7 axes, each with a reason
               citing the numbers that earned it
AfterAction ─ reads stats + evidence + twin + event log → deterministic
               narrative → advisor-client optionally Gemini-enhances in place
```

## Phase decisions

1. **EvidenceEngine** (`src/learning/evidence/`): on DecisionCommitted snapshot
   REAL telemetry (max corridor loading, supply balance, dark zones, unserved);
   after a 50-tick evaluation window snapshot again; `optimal` = measured
   improvement on any axis (loading −2 pts+, unserved/dark-zone drop, balance
   +20 MW+ — thresholds tested). Concepts per decision id from a catalog
   (op-ac-residential/op-ev-pause/op-lights-commercial → Demand Response +
   Transmission Loading; op-shed-* → Grid Resilience + Transmission Loading
   (+ Equity for harbor/industrial tradeoffs); dec-* prompts by content).
   Passive evidence: cascade contained after operator action → Cascading
   Failure↑; hospital zone never dark through a run → Equity↑; sustained
   renewable share ≥ 25 % → Renewable Integration↑. Records kept for the
   after-action (pre/post numbers). DI token, bound in bootstrap.
2. **LearnerTwin**: per-concept `{mastery, confidence, evidenceCount}`.
   Mastery moves ±(0.12/0.10) per measured verdict; confidence is a pure
   monotonic function of evidenceCount (n/(n+3)) — it rises only with
   evidence. Passive observations use half weight. Emits existing
   LearningUpdated events (no event-map change).
3. **run-stats-store** (`src/state/`): projection only; resets on tick
   regression (scenario restart); freezes on GameEnded.
4. **scoreRun** (`src/learning/scoring/run-score.ts`): deterministic 7-axis
   scores 0–100, each with a reason string citing measured values. Replaces
   placeholder scorer usage for the after-action.
5. **In-play advisor**: `advisor-store` (state) + `AdvisorCard` overlay
   (`src/ui/advisor/`, mounted in App — console untouched). Moments: corridor
   stress crossing 90 % (question + grounded number), first trip of a run
   (explanation citing line + T+), recovery after blackout (reinforcement),
   evidence verdicts ("Reduce residential AC: corridor stress 96 % → 78 %").
   ≥ 20 s between messages, dismissible, auto-expire.
6. **Gemini**: `advisor-client.ts` posts compact structured evidence
   (outcome, stats, score reasons, top timeline moments with real T+, decision
   records, mastery deltas) to `/api/advisor`, 6 s timeout → null on any
   failure. `api/advisor.ts` prompts rebuilt around the evidence contract with
   explicit "never invent" guardrails. Vite dev middleware serves the same
   handler locally (`GEMINI_API_KEY` via `.env.local`).
7. **AfterActionScreen**: rebuilt in daylight console style entirely from run
   data: mission summary, timeline, decision analysis with measured effects,
   mistakes/successes, concept mastery + deltas + confidence, grid
   performance, affected-household estimate (labeled), recovery time,
   renewable share, 7 scores with reasons, advisor narrative (deterministic
   shown instantly; Gemini swap-in when it responds).

## Validation gates

No mocked advisor text remains; twin mastery+confidence evolve only with
evidence; stats/timeline references verified against the log; Gemini absent →
identical conclusions; suite + build green.
