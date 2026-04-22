/**
 * /api/structure-slides — streams Claude's slide JSON to the browser.
 *
 * Uses stream:true (same pattern as analyze.js + six-pager.js) so the
 * connection stays alive for the full generation time. The browser collects
 * all text_delta chunks, assembles the JSON string, then parses it locally.
 *
 * Slide types returned:
 *   cover | kpi | exec-summary | competitor | comparison | implications | actions
 */
export default async (request) => {
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
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body;
  try { body = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const { markdown = "", title = "Competitor Intelligence", competitors = [] } = body;
  if (!markdown.trim()) return new Response("Missing markdown", { status: 400 });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return new Response("Missing API key", { status: 500 });

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const SYSTEM = `You are an elite McKinsey-style presentation designer creating a C-suite executive slide deck.

Return ONLY valid JSON — no markdown fences, no explanation, no extra text before or after.

JSON schema:
{
  "slides": [
    { "type": "cover",        "title": string, "competitors": string[], "date": string },
    { "type": "kpi",          "title": string, "metrics": [{ "label": string, "value": string, "unit": string, "delta": string, "sentiment": "positive"|"negative"|"neutral" }] },
    { "type": "exec-summary", "headline": string, "points": string[] },
    { "type": "competitor",   "name": string, "domain": string, "tagline": string, "stat": { "label": string, "value": string }, "bullets": string[] },
    { "type": "comparison",   "title": string, "headers": string[], "rows": string[][] },
    { "type": "implications", "risks": string[], "opportunities": string[] },
    { "type": "actions",      "title": string, "actions": [{ "number": number, "title": string, "detail": string, "owner": string, "timeline": string }] }
  ]
}

STRICT RULES:
- Max 4 bullets per competitor slide. Each bullet max 15 words.
- exec-summary: max 5 points each max 18 words. Headline: assertive, max 20 words.
- kpi: exactly 4 metrics. Use real publicly-known numbers; label estimates (est.)
- implications: max 4 risks, max 4 opportunities. Specific, sharp.
- actions: max 5. Must have owner role and specific timeline.
- One competitor slide per company mentioned in the report. Include ALL companies.
- NEVER use jargon. Write like a confident product leader briefing the CEO.`;

  const userMsg = [
    `Report title: "${title}"`,
    `Date: ${today}`,
    `Competitors: ${competitors.join(", ")}`,
    "",
    "Report to convert:",
    markdown,
  ].join("\n");

  const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "X-Api-Key":         apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-sonnet-4-5",
      max_tokens: 8192,
      stream:     true,
      system:     SYSTEM,
      messages:   [{ role: "user", content: userMsg }],
    }),
  });

  if (!anthropicResp.ok) {
    const err = await anthropicResp.text();
    return new Response(`Anthropic API error ${anthropicResp.status}: ${err}`, {
      status: anthropicResp.status,
    });
  }

  /* Stream straight through — browser collects + parses JSON locally */
  return new Response(anthropicResp.body, {
    status: 200,
    headers: {
      "Content-Type":                "text/event-stream",
      "Cache-Control":               "no-cache",
      "Access-Control-Allow-Origin": "*",
    },
  });
};

export const config = { path: "/api/structure-slides" };
