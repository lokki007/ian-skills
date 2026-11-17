#!/usr/bin/env node
// /keyword step 4: harvest.json + enrich.json + analysis.json → report.html (one self-contained page, Artifact-ready).
//   node render.mjs --dir <dir>
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const DIR = (() => { const i = argv.indexOf('--dir'); return i >= 0 ? argv[i + 1] : '.'; })();
const read = (f, d) => (existsSync(join(DIR, f)) ? JSON.parse(readFileSync(join(DIR, f), 'utf8')) : d);
const H = read('harvest.json');
const E = read('enrich.json', { metrics: { rows: [] }, web: [], reddit: [], youtube: [], spend: {} });
const A = read('analysis.json', {});

const met = new Map((E.metrics?.rows || []).map((m) => [m.k, m]));
const rows = H.rows.slice(0, 3000).map((r) => {
  const m = met.get(r.k);
  return { k: r.k, s: r.score, i: r.intent, q: r.question ? 1 : 0, n: r.sources.length, c: r.cluster, o: r.origin === 'seed' ? 0 : 1,
    ...(m ? { v: m.volume, cpc: m.cpc ?? (m.cpcLow != null && m.cpcHigh != null ? (m.cpcLow + m.cpcHigh) / 2 : null), kd: m.kd ?? m.competitionIndex, chg: m.chg, ser: m.series } : {}) };
});
// metrics for keywords that were not in the harvested top 3000 still count
for (const m of met.values()) if (!rows.some((r) => r.k === m.k)) rows.push({ k: m.k, s: 0, i: 'other', q: 0, n: 0, c: null, o: 0, v: m.volume, cpc: m.cpc, kd: m.kd ?? m.competitionIndex, chg: m.chg, ser: m.series });

const data = {
  seeds: H.seeds, market: H.market, generatedAt: H.generatedAt, engine: H.engine, stats: H.stats,
  clusters: H.clusters, facets: H.facets, rows,
  youtube: (E.youtube || []).flatMap((y) => y.videos.map((v) => ({ ...v, q: y.query }))).sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 15),
  web: (E.web || []).map((w) => ({ q: w.query, n: w.results.length })),
  reddit: (E.reddit || []).reduce((n, r) => n + r.posts.length, 0),
  metricsStatus: E.metrics?.status || 'skipped', metricsErrors: E.metrics?.errors || [],
  spend: E.spend || {}, analysis: A,
};
const json = JSON.stringify(data).replace(/</g, '\\u003c');
const tpl = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'report-template.html'), 'utf8');
const title = `${H.seeds[0].replace(/\b\w/g, (c) => c.toUpperCase())} Keyword Field`;
const html = tpl.replace('{{TITLE}}', title.replace(/[<&]/g, '')).replace('{{DATA}}', () => json);
writeFileSync(join(DIR, 'report.html'), html);
console.log(`wrote ${join(DIR, 'report.html')} (${(html.length / 1024).toFixed(0)} KB, ${rows.length} keywords, ${met.size} with metrics)`);
