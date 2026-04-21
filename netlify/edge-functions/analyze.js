/**
 * Netlify Edge Function — proxies streaming requests to Anthropic.
 * The ANTHROPIC_API_KEY lives in Netlify env vars, never in client code.
 *
 * Endpoint: POST /api/analyze
 * Body: { competitors: string[], dims: string[], mode: string }
 */
export default async (request, context) => {
  /* ── CORS pre-flight ─────────────────────────────── */
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  /* ── Parse request body ──────────────────────────── */
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { competitors = [], dims = [], mode = "compare" } = body;

  if (!competitors.length || !dims.length) {
    return new Response("Missing competitors or dims", { status: 400 });
  }

  // If Walmart is selected, it becomes the reference company (not a competitor)
  const walmartSelected = competitors.includes("Walmart");
  const peers           = competitors.filter((c) => c !== "Walmart");
  const refCompany      = walmartSelected ? "Walmart" : "Reference Company";

  if (!peers.length) {
    return new Response("Select at least one competitor alongside Walmart", { status: 400 });
  }

  /* ── Build prompt ────────────────────────────────── */
  const SYSTEM_PROMPT = `You are a competitive intelligence assistant specialising in retail and e-commerce.
Provide clear, structured, business-ready insights for non-technical decision makers.

Always structure your response in EXACTLY this format using ## headers:

## SECTION 1: EXECUTIVE SUMMARY
3-5 bullet points summarising key insights.

## SECTION 2: COMPETITOR BREAKDOWN
For each competitor AND the reference company: ### Heading, then Key moves, Strengths, Weaknesses as bullet points.

## SECTION 3: COMPARISON TABLE
A markdown table. Columns = each competitor + reference company. Rows = selected focus areas only.

## SECTION 4: WHAT CHANGED RECENTLY
Recent developments, news, trends based on publicly available knowledge.

## SECTION 5: IMPLICATIONS
Risks and opportunities the reference company can leverage.

## SECTION 6: RECOMMENDED ACTIONS
3-5 clear, practical recommendations.

Rules:
- Use ONLY publicly available information — no internal or proprietary data
- Only cover focus areas specified in the user message
- Use real numbers/metrics where available; label estimates with (est.)
- Keep language simple, think like a product leader advising a CEO
- Be concise and insight-driven`;

  const subjects = [...peers, refCompany];
  const userMsg = [
    `Produce a full competitive intelligence report for ${refCompany}, comparing against: ${peers.join(", ")}.`,
    "",
    "Focus areas (cover ONLY these):",
    dims.map((d) => `- ${d}`).join("\n"),
    "",
    `Mode: ${mode === "single" || peers.length === 1 ? "deep-dive" : "multi-competitor comparison"}`,
    `Section 2 order: ${subjects.join(", ")}`,
    `Section 3 table columns: ${subjects.join(", ")}. Rows = focus areas only.`,
    "",
    "Use real publicly available metrics; label estimates (est.). Keep language executive-friendly.",
  ].join("\n");

  /* ── Call Anthropic API (streaming) ──────────────── */
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response("Server configuration error: missing API key", { status: 500 });
  }

  const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":    "application/json",
      "X-Api-Key":       apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-sonnet-4-5",
      max_tokens: 8192,
      stream:     true,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: userMsg }],
    }),
  });

  if (!anthropicResp.ok) {
    const err = await anthropicResp.text();
    return new Response(`Anthropic API error ${anthropicResp.status}: ${err}`, {
      status: anthropicResp.status,
    });
  }

  /* ── Stream response straight through to client ─── */
  return new Response(anthropicResp.body, {
    status: 200,
    headers: {
      "Content-Type":                "text/event-stream",
      "Cache-Control":               "no-cache",
      "Access-Control-Allow-Origin": "*",
    },
  });
};

export const config = { path: "/api/analyze" };
