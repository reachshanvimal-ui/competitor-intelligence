/**
 * /api/six-pager — Claude writes a proper Amazon-style 6-page narrative doc.
 * Returns { html: "..." } — the browser downloads it as .doc
 *
 * Amazon 6-pager rules enforced in the prompt:
 * - No bullet points in the body (prose only)
 * - Short paragraphs (3-5 sentences max)
 * - Data-backed assertions; estimates labelled (est.)
 * - Present tense for current state, past tense for history
 * - Sections: Context → Competitive Landscape → Recent Moves →
 *             Walmart's Position → Implications → Recommended Actions
 * - Appendix: comparison table
 */
export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body;
  try { body = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const { markdown = "", title = "Competitive Intelligence", competitors = [] } = body;
  if (!markdown.trim()) return new Response("Missing markdown", { status: 400 });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return new Response("Missing API key", { status: 500 });

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const SYSTEM = `You are a strategic writer producing an Amazon-style 6-pager competitive intelligence memo.

Amazon 6-pager rules (non-negotiable):
1. NO bullet points in body sections — write in clear, flowing prose paragraphs
2. Max 3-5 sentences per paragraph. Be direct. Cut every word that adds no meaning.
3. Every claim must be backed by a number or specific fact. Label estimates (est.).
4. Present tense for current state. Past tense for historical events.
5. The document must be exactly 6 pages when printed at 11pt Calibri, 1" margins.
6. Voice: confident, direct, executive. No hedging. No jargon.
7. Bullets ONLY allowed in the Appendix comparison table.

Return ONLY a JSON object with one field: { "html": "<complete HTML document string>" }

The HTML document must:
- Use inline CSS only (no external stylesheets)
- Font: font-family: Calibri, sans-serif
- Body: font-size: 11pt, line-height: 1.5, margin: 1in on all sides
- Heading 1 (section titles): font-size: 13pt, font-weight: bold, border-bottom: 1px solid #333, margin-top: 24pt
- Heading 2 (sub-sections): font-size: 11pt, font-weight: bold, margin-top: 16pt
- Paragraphs: margin: 6pt 0
- Page breaks between major sections: <div style="page-break-after:always"></div>
- Memo header at top (Amazon-style): To, From, Date, Re: fields in a small table
- Confidentiality notice at bottom of page 1
- Appendix: one comparison table at end with borders, alternating rows

Structure (in this exact order):
1. MEMO HEADER — To: Leadership Team | From: AI Competitive Intelligence | Date: [date] | Re: [title]
2. CONTEXT & BACKGROUND — What is the competitive landscape? Why does this analysis matter now? (2 paragraphs)
3. COMPETITIVE LANDSCAPE — One sub-section per competitor. 2-3 paragraphs each: their strategy, recent moves, key metrics, and threat level. (page break after)
4. WALMART'S CURRENT POSITION — Where Walmart stands relative to each dimension analyzed. Honest assessment. (1 page)
5. KEY IMPLICATIONS — What this means for Walmart. Specific risks with probability and impact. Specific opportunities with sizing. (1 page, page break after)
6. RECOMMENDED ACTIONS — 4-6 actions. Each action: name it, explain the rationale (2-3 sentences), state the owner role, state the timeline. Prose, not bullets. (1 page)
7. APPENDIX — Comparison table with borders. Columns: Focus Area + one per company. Rows: each focus area analyzed.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5", max_tokens: 8192, system: SYSTEM,
      messages: [{
        role: "user",
        content: `Write a 6-pager for:\nTitle: ${title}\nDate: ${today}\nCompetitors analysed: ${competitors.join(", ")}\n\nSource report (use all insights from this):\n${markdown}`,
      }],
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
    // Claude occasionally returns raw HTML without the JSON wrapper — handle gracefully
    if (raw.trim().startsWith("<!DOCTYPE") || raw.trim().startsWith("<html")) {
      parsed = { html: raw };
    } else {
      return new Response(JSON.stringify({ error: "Invalid response from Claude", raw: raw.slice(0, 500) }),
        { status: 500, headers: { "Content-Type": "application/json", ...cors() } });
    }
  }

  return new Response(JSON.stringify(parsed), {
    headers: { "Content-Type": "application/json", ...cors() },
  });
};

function cors() {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" };
}

export const config = { path: "/api/six-pager" };
