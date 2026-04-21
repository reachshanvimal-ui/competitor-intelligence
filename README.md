# Competitor Intelligence — AI-Powered Analysis

> 🔍 A free, open-source tool for retail & e-commerce competitive intelligence. 
> Powered by Claude AI. Uses **only publicly available world knowledge** — no internal or proprietary data.

**[🌐 Live Demo →](https://competitor-intell.netlify.app)**

---

## ✨ What it does

1. **Select competitors** — Amazon, eBay, Target, Costco, Temu, Shein, Alibaba & more
2. **Choose focus areas** — Pricing, Marketplace Strategy, Trust & Safety, Innovation, etc.
3. **Analyze** — Claude AI streams a structured 6-section intelligence report live
4. **Export** — Download as HTML Slides (print-to-PDF ready) or Word document

### 6-Section Report Format
- **Executive Summary** — 3–5 bullet point highlights
- **Competitor Breakdown** — Key moves, strengths & weaknesses per company
- **Comparison Table** — Side-by-side across all selected focus areas
- **What Changed Recently** — Latest developments & trends
- **Implications** — Risks & opportunities
- **Recommended Actions** — 3–5 practical next steps

---

## 🚀 Deploy your own (free)

### Step 1 — Get an Anthropic API key
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up / log in → **API Keys** → **Create Key**
3. Add a card for billing (cost: ~$0.03 per full analysis)

### Step 2 — Fork & deploy to Netlify
1. Fork this repo on GitHub
2. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
3. Select your forked repo
4. In **Site settings → Environment variables**, add:
   ```
   ANTHROPIC_API_KEY = sk-ant-xxxxxxxxxxxxx
   ```
5. Deploy — Netlify handles everything else ✅

---

## 🛠 Tech stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla HTML + CSS + JS (zero dependencies) |
| Backend | Netlify Edge Function (Deno) |
| AI | Claude Sonnet (Anthropic) |
| Hosting | Netlify (free tier works) |

---

## 💰 Cost

| Usage | Cost |
|---|---|
| One full 8-section analysis | ~$0.03 |
| 100 analyses / month | ~$3.00 |
| Netlify hosting | Free |

---

## 📄 License

MIT — use it, fork it, build on it.

---

*All intelligence reports are generated from Claude's world knowledge training data only.
No internal, proprietary, or confidential data is used.*
