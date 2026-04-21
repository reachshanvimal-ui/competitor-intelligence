/**
 * /api/structure-slides — Claude produces a tight EXECUTIVE deck JSON.
 *
 * Slide types (all handled by pptxgenjs in the browser):
 *   cover      — title, competitors[], date
 *   kpi        — title, metrics[{label, value, unit, delta, sentiment}]
 *   exec-summary — headline, points[string] (max 5)
 *   competitor — name, domain, tagline, stat{label,value}, bullets[string] (max 4)
 *   comparison — title, headers[], rows[][]
 *   implications — risks[string], opportunities[string] (max 4 each)
 *   actions    — title, actions[{number,title,detail,owner,timeline}] (max 5)
 */
export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body;
  try { body = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const { markdown = "", title = "Competitor Intelligence", competitors = [] } = body;
  if (!markdown.trim()) return new Response("Missing markdown", { status: 400 });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return new Response("Missing API key", { status: 500 });

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const SYSTEM = `You are an elite McKinsey-style presentation designer creating a C-suite executive slide deck.

Return ONLY valid JSON — no markdown fences, no explanation.

JSON schema:
{
  "slides": [
    {
      "type": "cover",
      "title": "<report title, max 10 words>",
      "competitors": ["<name>", ...],
      "date": "<today's date>"
    },
    {
      "type": "kpi",
      "title": "At a Glance",
      "metrics": [
        { "label": "<metric name>", "value": "<number>", "unit": "<unit>", "delta": "<+/-X%>", "sentiment": "positive|negative|neutral" }
      ]
    },
    {
      "type": "exec-summary",
      "headline": "<one powerful sentence, max 20 words>",
      "points": ["<insight 1>", "<insight 2>", "<insight 3>", "<insight 4>", "<insight 5>"]
    },
    {
      "type": "competitor",
      "name": "<company name>",
      "domain": "<company.com>",
      "tagline": "<their brand position, max 8 words>",
      "stat": { "label": "<key metric label>", "value": "<impressive number>" },
      "bullets": ["<key move>", "<strength>", "<weakness>", "<Walmart implication>"]
    },
    {
      "type": "comparison",
      "title": "Head-to-Head Comparison",
      "headers": ["Focus Area", "<company1>", "<company2>", "..."],
      "rows": [["<area>", "<rating or text>", "..."]]
    },
    {
      "type": "implications",
      "risks": ["<risk 1>", "<risk 2>", "<risk 3>"],
      "opportunities": ["<opp 1>", "<opp 2>", "<opp 3>"]
    },
    {
      "type": "actions",
      "title": "Recommended Actions",
      "actions": [
        { "number": 1, "title": "<action title>", "detail": "<one line detail>", "owner": "<who>", "timeline": "<when>" }
      ]
    }
  ]
}

STRICT RULES — executives see these on a projector:
- Max 4 bullets per competitor slide. Each bullet max 15 words.
- Exec summary: max 5 points, each max 18 words. Headline must be assertive, not vague.
- KPI: 4 metrics max. Use real publicly-known numbers; label estimates with (est.)
- Implications: max 4 risks, max 4 opportunities. Sharp, specific.
- Actions: max 5. Must have owner role and specific timeline.
- NEVER use jargon. Write like a confident product leader briefing the CEO.
- One competitor slide per company in the report. Include a competitor slide for every company mentioned.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5", max_tokens: 8192, system: SYSTEM,
      messages: [{ role: "user", content: `Report title: "${title}"\nDate: ${today}\nCompetitors: ${competitors.join(", ")}\n\nReport:\n${markdown}` }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return new Response(`Anthropic error ${resp.status}: ${err}`, { status: resp.status });
  }

  const data = await resp.json();
  const raw  = (data?.content?.[0]?.text ?? "")
    .replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  let parsed;
  try { parsed = JSON.parse(raw); } catch {
    return new Response(JSON.stringify({ error: "Claude returned invalid JSON", raw: raw.slice(0, 500) }),
      { status: 500, headers: { "Content-Type": "application/json", ...cors() } });
  }

  return new Response(JSON.stringify(parsed), {
    headers: { "Content-Type": "application/json", ...cors() },
  });
};

function cors() {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" };
}

export const config = { path: "/api/structure-slides" };
