#!/usr/bin/env node
// /keyword step 1: free, keyless harvest with Wordhoard's engine.
//   node harvest.mjs --seeds "ai tutor, homework helper" [--out <dir>] [--deeper 10] [--gl us] [--hl en]
//                    [--sources google,youtube,bing,ddg,amazon,gshopping] [--exclude "word, other phrase"]
// Without --out the folder is <KEYWORD_REPORTS_DIR or ./keyword-reports>/<slug>-<YYYY-MM-DD>.
// Writes <dir>/harvest.json and <dir>/keywords.csv, prints a compact digest for the agent.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { engine } from './engine.mjs';

const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : def; };
const seedsIn = arg('seeds', argv.find((a) => !a.startsWith('--')) || '');
const slugOf = (s) => String(s).split(/[,;\n]+/)[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'keyword';
const OUT = resolve(arg('out', join(process.env.KEYWORD_REPORTS_DIR || 'keyword-reports', `${slugOf(seedsIn)}-${new Date().toISOString().slice(0, 10)}`)));
const DEEPER = Number(arg('deeper', '10'));
const MARKET = { gl: arg('gl', 'us'), hl: arg('hl', 'en') };
const SOURCES = arg('sources', 'google,youtube,bing,ddg,amazon,gshopping').split(',').map((s) => s.trim()).filter(Boolean);
const DEEP_SOURCES = ['google', 'youtube', 'bing', 'ddg'].filter((s) => SOURCES.includes(s));
const EXCLUDE = arg('exclude', '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

const { api, zipf, version } = engine();
const seeds = String(seedsIn).split(/[,;\n]+/).map((s) => api.whNormalize(s)).filter(Boolean).slice(0, 5);
if (!seeds.length) { console.error('usage: harvest.mjs --seeds "keyword[, keyword…]" --out <dir>'); process.exit(2); }
mkdirSync(OUT, { recursive: true });

// ---------- polite fetching: a worker pool per host ----------
const stats = { requests: 0, ok: 0, refused: 0, failed: 0, hosts: {} };
const hostState = new Map();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isRefusal = (status, text) => status === 429 || status === 403
  || (status === 200 && /captcha|unusual traffic|\/sorry\/index|are you a robot/i.test(text.slice(0, 4000)) && !/^\s*[[{]/.test(text));

async function fetchOne(req) {
  const h = hostState.get(req.host);
  for (let attempt = 0; attempt < 3; attempt++) {
    if (h.dead) return null;
    try {
      const res = await fetch(req.url, { headers: { 'user-agent': UA, accept: 'application/json,text/plain,*/*' }, signal: AbortSignal.timeout(10000) });
      const text = await res.text();
      if (isRefusal(res.status, text)) {
        stats.refused++; h.refusals++;
        if (h.refusals > 12) { h.dead = true; return null; }
        await sleep(20000 * (attempt + 1));
        continue;
      }
      if (res.status !== 200) { stats.failed++; return null; }
      stats.ok++;
      return text;
    } catch { stats.failed++; await sleep(500); }
  }
  return null;
}

async function runAll(reqs, label) {
  const byHost = new Map();
  for (const r of reqs) { if (!byHost.has(r.host)) byHost.set(r.host, []); byHost.get(r.host).push(r); }
  let done = 0; const total = reqs.length; const t0 = Date.now();
  const tick = setInterval(() => process.stderr.write(`\r${label}: ${done}/${total}   `), 1000);
  await Promise.all([...byHost.entries()].map(async ([host, list]) => {
    if (!hostState.has(host)) hostState.set(host, { refusals: 0, dead: false, last: 0 });
    const h = hostState.get(host);
    const conc = host.includes('google') ? 3 : 4, gap = host.includes('google') ? 90 : 60;
    let i = 0;
    await Promise.all(Array.from({ length: conc }, async () => {
      while (i < list.length) {
        const req = list[i++];
        const wait = h.last + gap - Date.now(); h.last = Math.max(Date.now(), h.last + gap);
        if (wait > 0) await sleep(wait);
        stats.requests++; stats.hosts[host] = (stats.hosts[host] || 0) + 1;
        req.text = await fetchOne(req); done++;
      }
    }));
  }));
  clearInterval(tick);
  process.stderr.write(`\r${label}: ${done}/${total} in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
}

function requestsFor(seed, kinds, sources, tag) {
  const out = [];
  for (const { q, kind } of api.whExpansions(seed, kinds)) {
    for (const source of sources) {
      const def = api.WORDHOARD_SOURCES[source];
      if (!def) continue;
      const url = def.url(q, MARKET);
      out.push({ seed, source, q, kind: tag || kind, url, host: new URL(url).hostname });
    }
  }
  return out;
}

function toResults(reqs) {
  const out = [];
  for (const r of reqs) {
    if (!r.text) continue;
    const def = api.WORDHOARD_SOURCES[r.source];
    let items = [];
    try { items = def.text ? def.parse(r.text) : def.parse(JSON.parse(r.text)); } catch { items = []; }
    out.push({ seed: r.seed, source: r.source, q: r.q, kind: r.kind, items: items.map((it) => ({ ...it, z: api.whZipfOf(it.k, r.seed, zipf) })) });
  }
  return out;
}

// ---------- round 1: every seed, full expansion ----------
const allKinds = Object.keys(api.WORDHOARD_KINDS);
const round1 = seeds.flatMap((s) => requestsFor(s, allKinds, SOURCES));
await runAll(round1, 'round 1');
const results = toResults(round1);
// ---------- excludes (before clustering, so the deeper round is not spent on other meanings) ----------
const EX_RE = EXCLUDE.length ? new RegExp(`\\b(${EXCLUDE.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i') : null;
const keep = (r) => r.score > 0 && api.whIsKeyword(r.k) && !(EX_RE && EX_RE.test(r.k));
let rows = api.whMergeSeeds(results, seeds).filter(keep);

// ---------- text helpers ----------
const STOP = new Set(('a an the for to of in on and or with my your i you is are do does can vs near me at by from how what why when where who which will should without like versus ' +
  'best free cheap top review reviews online price cost near 2025 2026 2027 it be this that get not no as if your our their its').split(' '));
const seedTokens = new Set(seeds.flatMap((s) => s.split(' ')).flatMap((t) => [t, api.whMergeKey ? api.whMergeKey(t) : t]));
const tokens = (k) => api.whNormalize(k).split(' ').filter(Boolean);
const sing = (t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t);
const extra = (k) => tokens(k).filter((t) => !seedTokens.has(t) && !seedTokens.has(sing(t)) && !STOP.has(t) && !/^\d+$/.test(t) && t.length > 1);

// ---------- sub-niche clusters from what people add to the seed ----------
function clusterize(list) {
  const maxScore = Math.max(1, ...list.map((r) => r.score));
  const w = new Map(), wBi = new Map();
  for (const r of list) {
    const ex = extra(r.k), weight = 0.3 + r.score / maxScore;
    for (const t of new Set(ex.map(sing))) w.set(t, (w.get(t) || 0) + weight);
    for (let i = 0; i < ex.length - 1; i++) { const b = `${sing(ex[i])} ${sing(ex[i + 1])}`; wBi.set(b, (wBi.get(b) || 0) + weight); }
  }
  const terms = [];
  for (const [b, v] of wBi) { const [x, y] = b.split(' '); if (v >= 1.5 && v >= 0.55 * Math.min(w.get(x) || 0, w.get(y) || 0)) terms.push([b, v * 1.1]); }
  for (const [t, v] of w) if (v >= 1.5) terms.push([t, v]);
  terms.sort((a, b) => b[1] - a[1]);
  const chosen = [];
  for (const [t, v] of terms) {
    if (chosen.length >= 36) break;
    const parts = t.split(' ');
    if (chosen.some((c) => c.term === t || (parts.length === 1 && c.term.split(' ').includes(t) && c.weight > v * 0.7))) continue;
    chosen.push({ term: t, weight: Math.round(v * 10) / 10, members: [] });
  }
  for (const r of list) {
    const ex = extra(r.k).map(sing), joined = ` ${ex.join(' ')} `;
    const hit = chosen.find((c) => joined.includes(` ${c.term} `));
    if (hit) { hit.members.push(r); r.cluster = hit.term; }
  }
  return chosen.filter((c) => c.members.length >= 2).map((c) => ({
    term: c.term, weight: c.weight, count: c.members.length,
    best: c.members.slice().sort((a, b) => b.score - a.score)[0].k,
    top: c.members.slice().sort((a, b) => b.score - a.score).slice(0, 12).map((r) => r.k),
  }));
}

// ---------- round 2: go deeper on the strongest sub-niches ----------
let clusters = clusterize(rows);
const deeperSeeds = [];
if (DEEPER > 0) {
  for (const c of clusters) {
    if (deeperSeeds.length >= DEEPER) break;
    const cand = rows.filter((r) => r.cluster === c.term && r.words <= 5 && !r.question).sort((a, b) => b.score - a.score)[0];
    if (cand && !seeds.includes(cand.k) && !deeperSeeds.includes(cand.k)) deeperSeeds.push(cand.k);
  }
  const round2 = deeperSeeds.flatMap((s) => requestsFor(s, ['seed', 'letters', 'questions'], DEEP_SOURCES, 'deeper'));
  await runAll(round2, 'round 2 (deeper)');
  const deepRows = api.whMergeSeeds(toResults(round2), deeperSeeds).filter(keep);
  const have = new Map(rows.map((r) => [r.key || r.k, r]));
  for (const r of deepRows) {
    const key = r.key || r.k;
    if (have.has(key)) { const h = have.get(key); h.sources = [...new Set([...h.sources, ...r.sources])]; continue; }
    r.score = Math.round(r.score * 0.7); r.origin = `deeper:${r.seed}`;
    rows.push(r); have.set(key, r);
  }
  rows.sort(api.whCompare);
  for (const r of rows) delete r.cluster;
  clusters = clusterize(rows);
}

// ---------- facets ----------
const PAIN = /\b(problems?|issues?|not working|doesn'?t work|won'?t|can'?t|cannot|broken|fix|fixing|error|stuck|hate|annoying|frustrat\w*|too (expensive|slow|hard|much)|struggl\w*|help with|stop|avoid|keeps?|fail\w*|scam|worth it|cancel\w*|refund|complaints?|mistakes?|risks?|side effects?|dangers?|bad|worst|overwhelm\w*|confus\w*|expensive|alternative to|without|hard to|difficult|why (is|does|do|won'?t|can'?t)|how to (stop|fix|get rid|deal|avoid|handle|cope))\b/;
const COMPARE = /\b(vs|versus|or|compared|comparison|alternatives?|like|similar to|competitors?)\b/;
const FORMATS = ['app', 'software', 'tool', 'tools', 'template', 'templates', 'course', 'book', 'books', 'kit', 'service', 'services', 'printable', 'pdf', 'excel', 'spreadsheet', 'notion', 'ai', 'chatgpt', 'plugin', 'extension', 'api', 'generator', 'calculator', 'checklist', 'worksheet', 'planner', 'tracker', 'game', 'games', 'video', 'youtube', 'podcast', 'community', 'coach', 'coaching', 'agency', 'consultant', 'near me', 'online', 'subscription', 'box', 'diy', 'ideas', 'examples', 'guide'];
const QW = ['how', 'what', 'why', 'can', 'is', 'are', 'does', 'which', 'when', 'where', 'who', 'should', 'will', 'do'];
const slim = (r) => ({ k: r.k, score: r.score, intent: r.intent, sources: r.sources.length });
const facets = { questions: {}, pains: [], comparisons: [], commercial: [], transactional: [], audiences: [], formats: [], brands: [] };
const aud = new Map(), fmt = new Map(), brands = new Map();
for (const r of rows) {
  const k = r.k;
  if (r.question) { const w = QW.find((q) => k.startsWith(`${q} `)) || 'other'; (facets.questions[w] ||= []).push(slim(r)); }
  if (PAIN.test(k)) facets.pains.push(slim(r));
  if (COMPARE.test(k)) facets.comparisons.push(slim(r));
  if (r.intent === 'commercial') facets.commercial.push(slim(r));
  if (r.intent === 'transactional') facets.transactional.push(slim(r));
  const m = k.match(/\bfor (?:a |an |the |my |your )?([a-z0-9'][a-z0-9' ]{1,28})$/);
  if (m && !/^(free|sale|me|you|it|that|this|money|cheap|one|two|week|the week|weekend|days?|now|today|beginners? and)$/.test(m[1]) && !seeds.some((s) => m[1].includes(s))) { const a = m[1].trim(); const x = aud.get(a) || { name: a, count: 0, score: 0, examples: [] }; x.count++; x.score += r.score; if (x.examples.length < 4) x.examples.push(k); aud.set(a, x); }
  for (const f of FORMATS) if (new RegExp(`(^|\\s)${f}(\\s|$)`).test(k)) { const x = fmt.get(f) || { name: f, count: 0, score: 0, examples: [] }; x.count++; x.score += r.score; if (x.examples.length < 4) x.examples.push(k); fmt.set(f, x); }
  const vs = k.match(/^(.+?) (?:vs|versus) (.+)$/);
  const alt = k.match(/^(.+?) alternatives?$|alternatives? to (.+)$/);
  for (const b of [vs?.[1], vs?.[2], alt?.[1], alt?.[2]].filter(Boolean)) {
    const name = b.trim(); if (seeds.includes(name) || name.split(' ').length > 4) continue;
    const x = brands.get(name) || { name, count: 0 }; x.count++; brands.set(name, x);
  }
}
facets.audiences = [...aud.values()].sort((a, b) => b.score - a.score).slice(0, 30);
facets.formats = [...fmt.values()].sort((a, b) => b.score - a.score).slice(0, 30);
facets.brands = [...brands.values()].sort((a, b) => b.count - a.count).slice(0, 30);
for (const key of ['pains', 'comparisons', 'commercial', 'transactional']) facets[key] = facets[key].slice(0, 150);
for (const q of Object.keys(facets.questions)) facets.questions[q] = facets.questions[q].slice(0, 40);

// ---------- candidates for paid metrics: strongest, spread over clusters and facets ----------
const pick = new Map();
const add = (k) => { if (k && pick.size < 300 && !pick.has(k)) pick.set(k, true); };
seeds.forEach(add);
rows.slice(0, 60).forEach((r) => add(r.k));
for (const c of clusters) c.top.slice(0, 4).forEach(add);
facets.commercial.slice(0, 20).forEach((r) => add(r.k));
facets.transactional.slice(0, 20).forEach((r) => add(r.k));
facets.pains.slice(0, 20).forEach((r) => add(r.k));
Object.values(facets.questions).flat().sort((a, b) => b.score - a.score).slice(0, 25).forEach((r) => add(r.k));
rows.slice(60, 400).forEach((r) => add(r.k));
const candidates = [...pick.keys()];

const out = {
  seeds, market: MARKET, generatedAt: new Date().toISOString(),
  engine: { version, sources: SOURCES }, // no local paths: this object ends up in the published report
  stats: { ...stats, keywords: rows.length, deeperSeeds },
  rows: rows.slice(0, 5000).map((r) => ({ k: r.k, score: r.score, intent: r.intent, question: r.question, words: r.words, sources: r.sources, kinds: r.kinds, seed: r.seed, origin: r.origin || 'seed', cluster: r.cluster || null })),
  clusters, facets, candidates,
};
writeFileSync(join(OUT, 'harvest.json'), JSON.stringify(out));
const csv = [['keyword', 'popularity', 'intent', 'question', 'sources', 'cluster', 'seed'], ...out.rows.map((r) => [r.k, r.score, r.intent, r.question ? 'yes' : '', r.sources.join(' '), r.cluster || '', r.seed])];
writeFileSync(join(OUT, 'keywords.csv'), api.whCsv(csv));

// ---------- digest ----------
const line = (l) => console.log(l);
line(`# harvest: ${seeds.join(', ')} (${MARKET.gl}/${MARKET.hl}) — Wordhoard ${version}`);
line(`keywords ${rows.length} | requests ${stats.requests} ok ${stats.ok} refused ${stats.refused} failed ${stats.failed} | deeper: ${deeperSeeds.join('; ') || '-'}`);
line(`\n## top 40\n${rows.slice(0, 40).map((r) => `${r.k} [${r.score} ${r.intent} ${r.sources.length}src]`).join('\n')}`);
line(`\n## clusters (${clusters.length})\n${clusters.map((c) => `${c.term} (${c.count}): ${c.top.slice(0, 6).join(' | ')}`).join('\n')}`);
line(`\n## pains (${facets.pains.length})\n${facets.pains.slice(0, 30).map((r) => r.k).join(' | ')}`);
line(`\n## comparisons\n${facets.comparisons.slice(0, 25).map((r) => r.k).join(' | ')}`);
line(`\n## brands seen: ${facets.brands.map((b) => b.name).join(', ')}`);
line(`## audiences: ${facets.audiences.map((a) => `${a.name}(${a.count})`).join(', ')}`);
line(`## formats: ${facets.formats.map((a) => `${a.name}(${a.count})`).join(', ')}`);
line(`\n## top questions\n${Object.values(facets.questions).flat().sort((a, b) => b.score - a.score).slice(0, 30).map((r) => r.k).join('\n')}`);
line(`\nwrote ${join(OUT, 'harvest.json')} (${candidates.length} metric candidates)`);
line(`OUT=${OUT}`);
