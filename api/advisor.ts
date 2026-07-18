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
// Prompt builders
// ---------------------------------------------------------------------------
interface AdvisorRequestBody {
  mode: 'live' | 'postmortem';
  gridState: { loadPct: number; zoneAtRisk: string };
  twinState: { blackoutsCaused: number; conceptMastery: Record<string, number> };
  decisionLog?: Array<{ action: string; zone: string; outcome: string }>;
}

function buildLiveAdvisorPrompt(body: AdvisorRequestBody) {
  return {
    contents: [{
      parts: [{
        text:
          `You are an AI energy advisor inside a power-grid crisis simulation called GridGuard. ` +
          `Grid load is at ${body.gridState.loadPct}% in zone "${body.gridState.zoneAtRisk}". ` +
          `The learner has caused ${body.twinState.blackoutsCaused} blackout(s) so far. ` +
          `Give ONE short, simple suggestion (1–2 sentences) and a one-line reason. ` +
          `Never suggest shedding a critical zone (hospital). ` +
          `Respond in JSON: { "suggestion": "...", "reason": "...", "confidence": 0.0–1.0 }`
      }]
    }]
  };
}

function buildPostmortemPrompt(body: AdvisorRequestBody) {
  return {
    contents: [{
      parts: [{
        text:
          `You are an AI energy advisor writing a post-mortem for a power-grid crisis simulation called GridGuard. ` +
          `Here is the full decision log: ${JSON.stringify(body.decisionLog ?? [])}. ` +
          `The learner's concept mastery: ${JSON.stringify(body.twinState.conceptMastery)}. ` +
          `Write a short, encouraging post-mortem (4–6 sentences) that: ` +
          `(1) names the single most consequential decision and what a stronger choice would have looked like, ` +
          `(2) checks whether any low-income zone was shed more than a high-income zone and gently flags it if so, ` +
          `(3) ends with one concrete tip for the next attempt. ` +
          `Do not shame the learner — this is formative feedback, not a grade. ` +
          `Respond in JSON: { "narrative": "...", "keyDecision": "...", "equityFlag": true|false, "tip": "..." }`
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'server_misconfigured', message: 'GEMINI_API_KEY not set' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
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
