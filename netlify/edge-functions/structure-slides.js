/**
 * Netlify Edge Function — /api/structure-slides
 *
 * Takes the finished markdown intelligence report and asks Claude to
 * return a clean JSON slide deck structure. The browser then feeds
 * that JSON to pptxgenjs to produce a real .pptx file.
 *
 * Claude call here is NON-streaming (we need the full JSON at once).
 */
export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body;
  try { body = await request.json(); } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { markdown = "", title = "Competitor Intelligence Report" } = body;
  if (!markdown.trim()) {
    return new Response("Missing markdown", { status: 400 });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response("Server configuration error: missing API key", { status: 500 });
  }

  const SYSTEM = `You are a presentation designer. Convert a competitive intelligence report into a JSON slide deck.

Return ONLY valid JSON — no markdown fences, no explanation, no extra text.

JSON schema:
{
  "slides": [
    { "type": "cover",   "title": string, "subtitle": string },
    { "type": "section", "title": string },
    { "type": "bullets", "title": string, "bullets": string[] },
    { "type": "table",   "title": string, "headers": string[], "rows": string[][] }
  ]
}

Rules:
- First slide: type "cover" with the report title and today's date as subtitle
- Each ## section gets a "section" divider slide then one or more "bullets" slides
- Max 6 bullets per slide — split into multiple slides if needed
- The comparison table (## SECTION 3) becomes a "table" slide
- Strip all markdown formatting (**bold**, *italic*, etc.) from text
- Keep bullet text concise — max 120 chars per bullet
- Recommended order: cover → exec summary → competitor breakdown → table → recent news → implications → actions`;

  const userMsg = `Convert this competitive intelligence report into a slide deck JSON:\n\n${markdown}`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "X-Api-Key":         apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-sonnet-4-5",
      max_tokens: 8192,
      system:     SYSTEM,
      messages:   [{ role: "user", content: userMsg }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return new Response(`Anthropic error ${resp.status}: ${err}`, { status: resp.status });
  }

  const data = await resp.json();
  const raw  = data?.content?.[0]?.text ?? "";

  // Strip any accidental markdown fences Claude might add
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Claude returned invalid JSON", raw: cleaned.slice(0, 500) }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } }
    );
  }

  return new Response(JSON.stringify(parsed), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
};

function corsHeaders() {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" };
}

export const config = { path: "/api/structure-slides" };
