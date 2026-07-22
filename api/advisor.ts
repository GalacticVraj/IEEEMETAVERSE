/**
 * /api/advisor — Vercel Edge Function proxy for Gemini API.
 *
 * This runs on the SERVER (Vercel infrastructure), never bundled into client JS.
 * The GEMINI_API_KEY is read from process.env, which is only available here.
 * The frontend calls `fetch('/api/advisor', ...)` and never sees the key.
 */
export const config = { runtime: 'edge' };

// ---------------------------------------------------------------------------
// Rate limiting (in-memory per-instance — fine for demo/competition)
// ---------------------------------------------------------------------------
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string, maxPerHour = 30): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + 3_600_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > maxPerHour;
}

// ---------------------------------------------------------------------------
// Prompt builders — evidence contract (§4)
//
// The client sends ONLY measured facts (timestamps, verdicts, scores with
// reasons). Gemini's job is to REWRITE that evidence into a warm educational
// narrative — it must never add events, numbers, or recommendations that are
// not derivable from the provided context.
// ---------------------------------------------------------------------------
interface AdvisorRequestBody {
  mode: 'live' | 'postmortem';
  context: unknown;
}

const GUARDRAILS =
  `HARD RULES: Use ONLY the evidence provided. Never invent timestamps, events, ` +
  `decisions, metrics, or recommendations that are not present in the data. ` +
  `Cite T+ timestamps exactly as given. If a section of evidence is empty, say so ` +
  `plainly instead of inventing content. Plain language, no generic AI phrasing, ` +
  `no bullet spam.`;

function buildPostmortemPrompt(body: AdvisorRequestBody) {
  return {
    contents: [{
      parts: [{
        text:
          `You are the operations mentor in GridGuard, a power-grid crisis simulator used ` +
          `to teach energy literacy. A learner just completed a run. Below is the MEASURED ` +
          `evidence from that run (real timestamps, real decision verdicts, real scores ` +
          `with reasons).\n\n${GUARDRAILS}\n\n` +
          `Write a single after-action narrative of at most 170 words with this arc: ` +
          `(1) what happened this run, citing 2–3 of the given T+ moments; ` +
          `(2) the intervention that mattered most, using its measured verdict and stress numbers; ` +
          `(3) ONE concrete improvement grounded strictly in the listed evidence (a worsened/no-effect ` +
          `decision, a low score reason, or a weak concept); ` +
          `(4) one specific, encouraging closing sentence tied to their mastery data.\n\n` +
          `EVIDENCE:\n${JSON.stringify(body.context)}`
      }]
    }]
  };
}

function buildLiveAdvisorPrompt(body: AdvisorRequestBody) {
  return {
    contents: [{
      parts: [{
        text:
          `You are the operations mentor in GridGuard, a power-grid crisis simulator. ` +
          `Rewrite the following measured observation into ONE short teaching sentence ` +
          `(max 30 words) for the operator.\n\n${GUARDRAILS}\n\n` +
          `OBSERVATION:\n${JSON.stringify(body.context)}`
      }]
    }]
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Rate limiting
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    // 200 with an error body: "no key" is the NORMAL degradation path — the
    // client falls back to deterministic text without console noise.
    return new Response(
      JSON.stringify({ error: 'no_api_key', message: 'GEMINI_API_KEY not set' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: AdvisorRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const prompt = body.mode === 'postmortem'
    ? buildPostmortemPrompt(body)
    : buildLiveAdvisorPrompt(body);

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prompt),
      }
    );

    if (!geminiRes.ok) {
      return new Response(JSON.stringify({ error: 'advisor_unavailable' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await geminiRes.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'advisor_network_error' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
