/**
 * /api/six-pager — streams an Amazon-style 6-pager HTML document from Claude.
 *
 * Mirrors the streaming pattern from analyze.js to avoid edge-function
 * timeouts (a full 6-pager takes ~45s — streaming keeps the connection alive).
 *
 * Claude writes raw HTML directly (no JSON wrapper).
 * The browser collects the SSE stream, assembles the HTML, and downloads it.
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

  const { markdown = "", title = "Competitive Intelligence", competitors = [] } = body;
  if (!markdown.trim()) return new Response("Missing markdown", { status: 400 });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return new Response("Missing API key", { status: 500 });

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const SYSTEM = `You are a strategic writer producing an Amazon-style 6-pager competitive intelligence memo.

OUTPUT FORMAT: Return a complete, self-contained HTML document. No JSON. No markdown. Raw HTML only.

AMAZON 6-PAGER RULES (non-negotiable):
1. No bullet points in body sections — flowing prose paragraphs only.
2. Max 3-5 sentences per paragraph. Cut every word that adds no meaning.
3. Every claim backed by a number or specific fact. Label estimates (est.).
4. Present tense for current state. Past tense for historical events.
5. Voice: confident, direct, executive. No hedging. No jargon.

HTML REQUIREMENTS:
- All CSS inline (no external stylesheets or <link> tags)
- font-family: Calibri, 'Segoe UI', sans-serif throughout
- body: font-size:11pt; line-height:1.6; margin:1in; color:#1a1a1a; max-width:7.5in
- Memo header: small table, monospace labels, top of page 1
- h1 (doc title): font-size:16pt; font-weight:700; color:#0f172a; margin-bottom:4pt
- h2 (section): font-size:13pt; font-weight:700; border-bottom:2px solid #2563eb;
  padding-bottom:4pt; margin-top:28pt; color:#0f172a
- h3 (company sub-heading): font-size:11pt; font-weight:700; color:#2563eb; margin-top:16pt
- p: margin:6pt 0
- Page breaks between major sections: <div style="page-break-after:always;height:0"></div>
- Confidentiality notice after memo header (small, grey)
- Appendix: comparison table with full borders, blue header row, alternating rows

DOCUMENT STRUCTURE (exactly this order):
1. MEMO HEADER TABLE — To: Leadership Team | From: AI Competitive Intelligence System | Date: ${today} | Re: [title]
2. CONFIDENTIALITY NOTICE — one line, small grey text
3. <h1>[Document Title]</h1>
4. <h2>Context & Background</h2> — 2 paragraphs: why this landscape matters now
5. <h2>Competitive Landscape</h2> — one <h3> per competitor, 2-3 paragraphs each:
   their strategy, recent moves, key metrics, threat to Walmart
6. PAGE BREAK
7. <h2>Walmart's Current Position</h2> — honest 1-page assessment across focus areas
8. <h2>Key Implications</h2> — specific risks (with probability/impact) and opportunities
   (with sizing). Prose only. No bullets.
9. PAGE BREAK
10. <h2>Recommended Actions</h2> — 4-6 actions, each as its own <h3>.
    For each: rationale (2-3 sentences), owner role, timeline. Prose only.
11. <h2>Appendix: Comparison Table</h2> — HTML table, columns: Focus Area + one per company`;

  const userMsg = [
    `Write a 6-pager for: "${title}"`,
    `Competitors analysed: ${competitors.join(", ")}`,
    `Date: ${today}`,
    "",
    "Use ALL insights from this source report:",
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

  /* Stream straight through — same pattern as analyze.js */
  return new Response(anthropicResp.body, {
    status: 200,
    headers: {
      "Content-Type":                "text/event-stream",
      "Cache-Control":               "no-cache",
      "Access-Control-Allow-Origin": "*",
    },
  });
};

export const config = { path: "/api/six-pager" };
