---
name: keyword
description: Cheap keyword and market research around a keyword, topic or niche, returned as a visual report. Harvests thousands of real searches free with Wordhoard's engine (Google, YouTube, Bing, DuckDuckGo, Amazon, Google Shopping autocomplete), finds sub-niches, questions, pains, audiences, formats and competitors, optionally adds paid evidence through DeepAPI for well under a dollar (search volume/CPC/difficulty, web, Reddit, YouTube), then renders a modern interactive report page. Use for "/keyword <topic>", "keyword research", "research the market around X", "find sub-niches / opportunities / pains for X", "what do people search about X".
license: MIT
---

# /keyword: research everything around a keyword

Input: one keyword, topic, or up to 5 comma-separated seeds (`/keyword meal prep`, `/keyword ai tutor, homework helper`).
Optional words from the user: market (`--gl uk`), "no paid", "deeper", things to exclude.

Output: a folder with `harvest.json`, `enrich.json`, `analysis.json`, `keywords.csv` and `report.html` (one self-contained page).

## Requirements and configuration

- Node 22+. No `npm install`; the scripts use only Node built-ins.
- `SKILL_DIR` below means the folder that holds this `SKILL.md`. Run the scripts from the user's project folder so reports land there.

Environment variables (nothing is read from dotfiles or fixed paths):

| Variable | Needed for | Default |
|---|---|---|
| `DEEPAPI_API_KEY` | Step 2 (paid enrichment) only | unset: step 2 is skipped |
| `DEEPAPI_API_BASE_URL` | Pointing at another DeepAPI host | `https://deepapi.co` |
| `KEYWORD_REPORTS_DIR` | Where report folders are created | `./keyword-reports` (under the current directory) |
| `WORDHOARD_EXT` | Using a newer Wordhoard engine folder (one holding `sources.js`) | the copy in `vendor/wordhoard/` |

**Without a DeepAPI key** you still get the full free harvest (thousands of autocomplete keywords from 6 engines, sub-niche clusters, questions, pain searches, comparisons, brands, audiences, formats, Wordhoard popularity scores) and the rendered report. Ranking then uses Wordhoard popularity, not measured search counts.

**With `DEEPAPI_API_KEY`** ([deepapi.co](https://deepapi.co), a paid API) the report adds Google search volume, CPC, keyword difficulty and 12-month trend, plus open-web, Reddit and YouTube evidence for pains and competitors. A typical run costs 20–60 US cents. When a DeepAPI call fails, the script sends DeepAPI one automatic bug report containing only the request id.

## Steps

**0. Seeds.** Use the user's words, normalized. A broad topic ("pets") still works; the deeper round finds the sub-niches.

**1. Harvest (free, no key, ~1 min).**
```
node "$SKILL_DIR/scripts/harvest.mjs" --seeds "<seeds>" --deeper 10 [--out <dir>] [--gl us --hl en] [--exclude "brand, other meaning"]
```
Without `--out`, the folder is `${KEYWORD_REPORTS_DIR:-./keyword-reports}/<slug>-<YYYY-MM-DD>`; the last line of output prints it as `OUT=<dir>`. Use that path below.

Round 1 = every seed × 61 expansions (seed, A–Z, 13 question words, 10 prepositions, 11 modifiers) × 6 engines, then Wordhoard merge and popularity ranking. Round 2 = the 10 strongest sub-niche heads × (seed, A–Z, questions) × 4 web engines. It prints a digest: top keywords, clusters, pain searches, comparisons, brands, audiences, formats, top questions. Read it. If a cluster is clearly another meaning of the seed (a brand, a band, a place), rerun with `--exclude` (excludes apply before the deeper round picks sub-niches). Ambiguous words ("offer", "coach") may need several reruns; adding unambiguous seeds is often easier than excluding every other meaning.

**2. Enrich (paid, DeepAPI, needs `DEEPAPI_API_KEY`).**
```
node "$SKILL_DIR/scripts/enrich.mjs" --dir "$OUT" [--metrics 200] [--web 8] [--youtube 3] [--no-metrics]
```
- `/v1/seo/keyword` on up to 200 metric candidates (volume, CPC, difficulty, 12-month trend; Google US only). If it fails, the report falls back to Wordhoard popularity and says so in its footer.
- 8 open-web searches (market size, top tools, complaints, Reddit-style frustration, alternatives/pricing, trends, underserved niches, per-cluster problems).
- Reddit search (3 queries over the seeds; it can come back empty, and empty answers are not charged) and YouTube search (seed + top clusters).

It prints a digest with snippets and URLs. This is the evidence. If it prints `LOW BALANCE`, tell the user the dollars left and that they can top up at https://deepapi.co/credits.
Skip this step when the user said "no paid" or when no key is set (the script exits cleanly with a note). The report still renders.

**3. Dig where it matters (optional, judgment, needs the key).** When pains or competitors are thin, scrape the 2–4 most telling URLs from the digest with DeepAPI (`POST /v1/scrape/website`), a Reddit thread (`/v1/scrape/reddit/comments`), or Amazon reviews (`/v1/scrape/amazon/reviews`) for product niches. Keep the extra spend under about 30 US cents unless the user asked for depth. Without a key, read the pages with whatever web tools you have. Quotes in the report must come from text you actually read.

**4. Write `$OUT/analysis.json`.** This is the thinking. Base every claim on the harvest and the evidence; name keywords that exist in `harvest.json`. Shape:
```json
{
  "headline": "one sentence: the most useful thing this research found",
  "summary": "3-4 sentences: the shape of the market, where demand is, where it's underserved",
  "verdict": { "label": "Go | Niche down | Crowded | Avoid", "reason": "one line" },
  "subniches": [{ "name": "Meal prep for one", "term": "<cluster term from harvest, if any>", "opportunity": 0-100,
                  "demand": "high|medium|low", "competition": "high|medium|low", "angle": "who it's for and the gap", "keywords": ["..."] }],
  "opportunities": [{ "title": "...", "type": "content | product | tool | service | affiliate | community",
                      "why": "the evidence in one or two sentences", "keywords": ["..."], "effort": "S|M|L", "upside": "high|medium|low" }],
  "pains": [{ "pain": "...", "severity": 1-5, "who": "...", "evidence": [{ "quote": "verbatim, short", "url": "...", "source": "r/mealprep" }], "idea": "how to answer it" }],
  "audiences": [{ "name": "...", "note": "...", "count": 3 }],
  "competitors": [{ "name": "...", "url": "...", "pricing": "...", "note": "what they own, where they're weak" }],
  "contentPlan": [{ "title": "...", "keyword": "...", "intent": "learn|compare|buy", "format": "article|video|tool|template" }],
  "risks": ["..."], "nextSteps": ["..."]
}
```
Aim for 8–14 sub-niches, 6–10 opportunities, 5–8 pains (each with real evidence), 8–15 content items. Opportunity scoring: demand (volume or popularity and cluster size) × weakness of competition × fit for the user's goals and resources (assume a small team or solo builder unless told otherwise); when volume is measured, prefer keywords with volume and difficulty under about 35. Omit fields you have no evidence for; the page hides empty sections.

**5. Render.**
```
node "$SKILL_DIR/scripts/render.mjs" --dir "$OUT"
```
This writes `$OUT/report.html`, a single self-contained page. If your environment can publish or preview HTML (for example an Artifact tool), publish it there; otherwise give the user the file path to open in a browser. Do not hand-edit the generated page; change `analysis.json` or the template and re-render.

**6. Reply** in a few lines: the verdict, the 3 best sub-niches/opportunities with their key numbers, the report link or path, the folder path, and what was paid. Mention if metrics failed or were skipped.

## Notes
- The report page: hero verdict + KPIs, opportunity map (volume × difficulty when measured, else sub-niche map), sub-niche cards, ranked opportunities, pains with quotes, question explorer, audiences/formats bars, competitors and comparison searches, rising keywords, content plan, YouTube winners, full filterable keyword table with CSV copy.
- Autocomplete hosts throttle bursts: the harvest keeps per-host pools (3 on Google, 4 elsewhere), backs off 20/40 s on a refusal and drops a host after 12. A full run is about 1,300 requests and normally sees no refusals.
- Popularity is Wordhoard's score (Spearman 0.715 vs Google Trends in Wordhoard's own benchmark), not a search count. Only DeepAPI metrics are counts.
- Template: `scripts/report-template.html`. Data contract between steps = the JSON files above.
- Third-party credits and the word-frequency data license (CC BY-SA 4.0): see `NOTICE.md`.
