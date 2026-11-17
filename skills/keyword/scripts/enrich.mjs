#!/usr/bin/env node
// /keyword step 2: cheap paid enrichment through DeepAPI (default cap well under $0.50).
//   node enrich.mjs --dir <dir> [--metrics 200] [--web 8] [--youtube 3] [--no-metrics]
// Reads <dir>/harvest.json, writes <dir>/enrich.json, prints a digest (snippets = evidence for pains/competitors).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { call, feedback, hasKey, spend } from './deepapi.mjs';

if (!hasKey()) {
  console.error('DEEPAPI_API_KEY is not set, so the paid enrichment step is skipped. The report still renders from the free harvest.\nSet DEEPAPI_API_KEY (https://deepapi.co) to add search volume, CPC, difficulty, web, Reddit and YouTube evidence.');
  process.exit(0);
}

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const DIR = arg('dir', '.');
const METRICS = argv.includes('--no-metrics') ? 0 : Number(arg('metrics', '200'));
const WEB = Math.max(5, Number(arg('web', '8')));
const YT = Number(arg('youtube', '3'));
const H = JSON.parse(readFileSync(join(DIR, 'harvest.json'), 'utf8'));
const seed = H.seeds[0];
const year = new Date().getFullYear();

// ---------- 1. keyword metrics (volume, CPC, difficulty, 12-month trend) ----------
const num = (...v) => { for (const x of v) { const n = typeof x === 'string' ? Number(x) : x; if (Number.isFinite(n)) return n; } return null; };
function normMetric(m) {
  const k = String(m.keyword ?? m.term ?? m.query ?? '').toLowerCase().trim();
  if (!k) return null;
  const months = Array.isArray(m.monthlySearches) ? m.monthlySearches : Array.isArray(m.trend) ? m.trend : [];
  const series = months.map((x) => num(x?.searchVolume, x?.volume, x?.search_volume, x)).filter((x) => x != null);
  const newest = series.slice(0, 3), oldest = series.slice(-3);
  const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const chg = newest.length && avg(oldest) ? Math.round(((avg(newest) - avg(oldest)) / avg(oldest)) * 100) : null;
  const comp = m.competition;
  return {
    k, volume: num(m.searchVolume, m.volume, m.search_volume, m.avgMonthlySearches),
    cpc: num(m.cpc, m.CPC, m.cpcUsd), cpcLow: num(m.cpcLow, m.lowTopOfPageBid), cpcHigh: num(m.cpcHigh, m.highTopOfPageBid),
    kd: num(m.keywordDifficulty, m.difficulty, m.kd), competition: typeof comp === 'string' ? comp.toUpperCase() : null,
    competitionIndex: num(m.competitionIndex, typeof comp === 'number' ? (comp <= 1 ? comp * 100 : comp) : null),
    intent: m.searchIntent ?? m.intent ?? null, series: series.slice().reverse(), chg,
  };
}
function metricList(out) {
  const arr = Array.isArray(out) ? out : out?.keywords ?? out?.results ?? out?.items ?? out?.data ?? [];
  return (Array.isArray(arr) ? arr : []).map(normMetric).filter(Boolean);
}
async function metrics() {
  if (!METRICS) return { status: 'skipped', rows: [] };
  const list = H.candidates.slice(0, METRICS);
  const batches = []; for (let i = 0; i < list.length; i += 100) batches.push(list.slice(i, i + 100));
  const rows = []; const errors = [];
  for (const b of batches) {
    const r = await call('/v1/seo/keyword', { keywords: b });
    if (r.status === 'succeeded') rows.push(...metricList(r.output));
    else { errors.push(`${r.error?.code}: ${r.error?.message} (${r.requestId})`); if (r.requestId) feedback(r.requestId, '/v1/seo/keyword failed during /keyword skill enrichment'); break; }
  }
  return { status: rows.length ? 'ok' : 'failed', rows, errors };
}

// ---------- 2. open-web search (5+ angles) ----------
const top = (H.clusters || []).slice(0, 3).map((c) => c.term);
const WEB_QUERIES = [
  `${seed} market size growth ${year}`,
  `best ${seed} tools apps companies ${year}`,
  `${seed} biggest problems complaints frustrations`,
  `${seed} reddit frustrated struggling wish I knew`,
  `${seed} alternatives competitors pricing comparison`,
  `${seed} trends ${year} what's new`,
  `${seed} niche business ideas underserved`,
  ...top.map((t) => `${seed} ${t} reddit problems`),
].slice(0, WEB);
async function web() {
  const res = await Promise.all(WEB_QUERIES.map(async (query) => {
    const r = await call('/v1/search/web', { query, maxResults: 10 });
    return { query, status: r.status, answer: r.output?.answer ?? null, results: (r.output?.results || []).map((x) => ({ title: x.title, url: x.url, snippet: x.snippet, date: x.dateText || null })) };
  }));
  return res;
}

// ---------- 3. Reddit (platform endpoint; empty answers are free) ----------
async function reddit() {
  const qs = [...H.seeds.slice(1, 3), `${H.seeds[H.seeds.length > 1 ? 1 : 0]} problem`, seed].slice(0, 3);
  const res = await Promise.all(qs.map(async (query) => {
    const r = await call('/v1/scrape/reddit/search', { query, maxItems: 25, sort: 'relevance' });
    const items = Array.isArray(r.output) ? r.output : [];
    return { query, status: r.status, posts: items.map((p) => ({ title: p.title, url: p.url || p.permalink, subreddit: p.subreddit || p.communityName, score: num(p.score, p.upVotes, p.ups), comments: num(p.numComments, p.commentsCount, p.num_comments), text: String(p.text || p.body || p.selftext || '').slice(0, 400) })) };
  }));
  return res;
}

// ---------- 4. YouTube: what content already wins ----------
async function youtube() {
  const qs = [seed, ...top.slice(0, Math.max(0, YT - 1)).map((t) => `${seed} ${t}`)].slice(0, YT);
  return Promise.all(qs.map(async (query) => {
    const r = await call('/v1/scrape/youtube/search', { query, maxItems: 12 });
    const items = Array.isArray(r.output) ? r.output : [];
    return { query, status: r.status, videos: items.filter((v) => v.type !== 'channel').map((v) => ({ title: v.title, url: v.url, views: v.views, comments: v.comments, published: v.publishedAt, channel: v.channel?.name, subs: v.channel?.subscribers })) };
  }));
}

const t0 = Date.now();
const [m, w, rd, yt] = await Promise.all([metrics(), web(), reddit(), youtube()]);
const out = { generatedAt: new Date().toISOString(), metrics: m, web: w, reddit: rd, youtube: yt, spend: { usd: spend.micro / 1e6, balanceUsd: spend.balance != null ? spend.balance / 1e6 : null, calls: spend.calls } };
writeFileSync(join(DIR, 'enrich.json'), JSON.stringify(out));

const L = (s) => console.log(s);
L(`# enrich (${((Date.now() - t0) / 1000).toFixed(0)}s, spent $${out.spend.usd.toFixed(3)}, balance ${out.spend.balanceUsd != null ? `$${out.spend.balanceUsd.toFixed(2)}` : '?'})`);
L(`metrics: ${m.status} ${m.rows.length} rows ${m.errors?.length ? `— ${m.errors.join('; ')}` : ''}`);
if (m.rows.length) L(m.rows.filter((r) => r.volume).sort((a, b) => b.volume - a.volume).slice(0, 30).map((r) => `${r.k}: ${r.volume}/mo cpc ${r.cpc ?? '-'} kd ${r.kd ?? '-'} chg ${r.chg ?? '-'}%`).join('\n'));
for (const s of w) { L(`\n## web: ${s.query} [${s.status}]`); if (s.answer) L(`answer: ${JSON.stringify(s.answer).slice(0, 300)}`); for (const x of s.results.slice(0, 6)) L(`- ${x.title} | ${x.url}\n  ${String(x.snippet || '').slice(0, 260)}`); }
for (const s of rd) { L(`\n## reddit: ${s.query} [${s.status}, ${s.posts.length}]`); for (const p of s.posts.slice(0, 10)) L(`- r/${p.subreddit} ${p.score ?? ''}↑ ${p.comments ?? ''}c: ${p.title} | ${p.url}\n  ${p.text.slice(0, 200)}`); }
for (const s of yt) { L(`\n## youtube: ${s.query}`); for (const v of s.videos.slice(0, 8)) L(`- ${v.views?.toLocaleString?.() ?? '?'} views | ${v.title} | ${v.channel} (${v.subs ?? '?'} subs) ${v.published?.slice(0, 10) ?? ''}`); }
if (out.spend.balanceUsd != null && out.spend.balanceUsd < 5) L(`\nLOW BALANCE: $${out.spend.balanceUsd.toFixed(2)} left on DeepAPI — top up at https://deepapi.co/credits`);
L(`\nwrote ${join(DIR, 'enrich.json')}`);
