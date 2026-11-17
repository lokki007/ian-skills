// Vendored from the Wordhoard browser extension (same author as this skill); distributed here under this
// repository's MIT license. See ../../NOTICE.md for third-party credits.
// Every free suggestion source, the expansion lists, intent and SERP rules, and the merging/scoring. Pure
// functions with no browser APIs. Endpoints and rules borrowed from open-source keyword tools credited inline.
const WH_AMAZON = { // marketplace ids and completion hosts per country
  us: ['completion.amazon.com', 'ATVPDKIKX0DER'], uk: ['completion.amazon.co.uk', 'A1F83G8C2ARO7P'], gb: ['completion.amazon.co.uk', 'A1F83G8C2ARO7P'],
  de: ['completion.amazon.de', 'A1PA6795UKMFR9'], fr: ['completion.amazon.fr', 'A13V1IB3VIYZZH'], es: ['completion.amazon.es', 'A1RKKUPIHCS9HS'],
  it: ['completion.amazon.it', 'APJ6JRA9NG5V4'], ca: ['completion.amazon.ca', 'A2EUQ1WTGCTBG2'], jp: ['completion.amazon.co.jp', 'A1VC38T7YXB528'],
  in: ['completion.amazon.in', 'A21TJRUUN4KGV'], mx: ['completion.amazon.com.mx', 'A1AM78C64UM0Y8'], au: ['completion.amazon.com.au', 'A39IBJ37TRP1C6'],
  br: ['completion.amazon.com.br', 'A2Q3Y263D00KWC'], nl: ['completion.amazon.nl', 'A1805IZSGTT6HS'],
};
// eBay site ids per country (autosug `sId`)
const WH_EBAY_SITE = { us: 0, ca: 2, uk: 3, gb: 3, au: 15, at: 16, be: 23, fr: 71, de: 77, it: 101, nl: 146, es: 186, ch: 193, ie: 205, pl: 212 };
const whEnc = encodeURIComponent;
const whHl = (o) => ((o && o.hl) || 'en').toLowerCase();
const whGl = (o) => ((o && o.gl) || 'us').toLowerCase();

// Google's own client format: [query, [suggestions], [descriptions], [], { 'google:suggestrelevance': [...], 'google:suggesttype': [...] }]
function whParseChrome(data) {
  if (!Array.isArray(data) || !Array.isArray(data[1])) return [];
  const meta = data[4] || {};
  const rel = meta['google:suggestrelevance'] || [];
  const types = meta['google:suggesttype'] || [];
  return data[1]
    .map((k, i) => ({ k: String(k), r: Number.isFinite(rel[i]) ? rel[i] : null, t: types[i] || 'QUERY' }))
    .filter((s) => s.t === 'QUERY' || s.t === 'PERSONALIZED_QUERY')
    .map(({ k, r }) => ({ k, r }));
}
// OpenSearch format shared by Firefox-style Google, YouTube, Bing, DuckDuckGo, Ecosia, Yandex: [query, [suggestions], ...]
function whParseOpenSearch(data) {
  if (!Array.isArray(data) || !Array.isArray(data[1])) return [];
  return data[1].map((k) => ({ k: typeof k === 'string' ? k : String((k && k.phrase) || ''), r: null })).filter((s) => s.k);
}
function whParseAmazon(data) {
  if (!data || !Array.isArray(data.suggestions)) return [];
  return data.suggestions.filter((s) => !s.type || s.type === 'KEYWORD').map((s) => ({ k: String(s.value || ''), r: null })).filter((s) => s.k);
}
const whList = (arr, pick) => (Array.isArray(arr) ? arr : []).map((e) => ({ k: String(pick(e) || ''), r: null })).filter((s) => s.k);

// `on`: default for every market. `markets`: countries (gl) where the source is on by default instead.
// `text`: the parser gets the raw response text (JSONP). `letter`/`color`: the badge on a row.
const WORDHOARD_SOURCES = {
  google: {
    name: 'Google', letter: 'G', color: '#4285f4', on: true,
    url: (q, o) => `https://suggestqueries.google.com/complete/search?client=chrome&hl=${whHl(o)}&gl=${whGl(o)}&q=${whEnc(q)}`,
    parse: whParseChrome, scored: true,
  },
  youtube: {
    name: 'YouTube', letter: 'Y', color: '#e53935', on: true,
    url: (q, o) => `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=${whHl(o)}&gl=${whGl(o)}&q=${whEnc(q)}`,
    parse: whParseOpenSearch,
  },
  bing: {
    name: 'Bing', letter: 'B', color: '#008373', on: true,
    url: (q, o) => `https://api.bing.com/osjson.aspx?query=${whEnc(q)}&market=${whHl(o)}-${whGl(o).toUpperCase()}`,
    parse: whParseOpenSearch,
  },
  ddg: {
    name: 'DuckDuckGo', letter: 'D', color: '#de5833', on: true,
    url: (q, o) => `https://duckduckgo.com/ac/?q=${whEnc(q)}&type=list&kl=${whGl(o)}-${whHl(o)}`,
    parse: whParseOpenSearch,
  },
  amazon: {
    name: 'Amazon', letter: 'A', color: '#ff9900', markets: Object.keys(WH_AMAZON),
    url: (q, o) => { const [host, mid] = WH_AMAZON[whGl(o)] || WH_AMAZON.us; return `https://${host}/api/2017/suggestions?mid=${mid}&alias=aps&prefix=${whEnc(q)}&limit=11&fresh=1&suggestion-type=KEYWORD`; },
    parse: whParseAmazon,
  },
  // Measured in Wordhoard's own benchmark runs against the four web engines: each adds 130–190 fresh keywords per seed (overlap 20–57 %)
  // and the Trends agreement rose, where Yahoo, Qwant, Google News and Images only echoed Google or added noise.
  gshopping: {
    name: 'Google Shopping', letter: 'S', color: '#34a853', on: true,
    url: (q, o) => `https://suggestqueries.google.com/complete/search?client=firefox&ds=sh&hl=${whHl(o)}&gl=${whGl(o)}&q=${whEnc(q)}`,
    parse: whParseOpenSearch,
  },
  walmart: {
    name: 'Walmart', letter: 'W', color: '#0071ce', markets: ['us', 'ca', 'mx'],
    url: (q) => `https://www.walmart.com/typeahead/v3/complete?term=${whEnc(q)}`,
    parse: (data) => whList(data && data.queries, (e) => (e.type === 'QUERY' ? e.displayName : '')),
  },
  ebay: {
    name: 'eBay', letter: 'E', color: '#e53238', markets: Object.keys(WH_EBAY_SITE), text: true, // answers JSONP, so the parser gets the raw text
    url: (q, o) => `https://autosug.ebay.com/autosug?kwd=${whEnc(q)}&sId=${WH_EBAY_SITE[whGl(o)] ?? 0}&_jgr=1&fb=1`,
    parse: (text) => {
      const i = text.indexOf('('), j = text.lastIndexOf(')');
      if (i < 0 || j < i) return [];
      const data = JSON.parse(text.slice(i + 1, j));
      return whList(data.res && data.res.sug, (k) => k);
    },
  },
  // Retail sources above are on where the store exists (Amazon marketplaces, eBay sites, Walmart US/CA/MX).
  // Market engines: on by default only where they are the market's engine (gl), off elsewhere.
  yandex: {
    name: 'Yandex', letter: 'Я', color: '#fc3f1d', markets: ['ru', 'ua', 'by', 'kz', 'tr'],
    url: (q, o) => `https://suggest.yandex.com/suggest-ff.cgi?uil=${whHl(o)}&part=${whEnc(q)}`,
    parse: whParseOpenSearch,
  },
  naver: {
    name: 'Naver', letter: 'N', color: '#03c75a', markets: ['kr'],
    url: (q) => `https://ac.search.naver.com/nx/ac?con=1&frm=nv&ans=2&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&run=2&rev=4&q_enc=UTF-8&st=100&q=${whEnc(q)}`,
    parse: (data) => whList(data && data.items && data.items[0], (e) => (Array.isArray(e) ? e[0] : '')),
  },
  baidu: {
    name: 'Baidu', letter: 'Bd', color: '#2932e1', markets: ['cn'],
    url: (q) => `https://www.baidu.com/sugrec?ie=utf-8&prod=pc&wd=${whEnc(q)}`,
    parse: (data) => whList(data && data.g, (e) => e.q),
  },
  seznam: {
    name: 'Seznam', letter: 'Sz', color: '#cc0000', markets: ['cz'],
    url: (q) => `https://suggest.seznam.cz/fulltext/cs?count=10&phrase=${whEnc(q)}`,
    parse: (data) => whList(data && data.result, (r) => (Array.isArray(r.text) ? r.text.map((t) => t.text).join('') : '')),
  },
  // Extra engines, off by default: Bing-backed (Ecosia, Swisscows) or special audiences (TikTok, Scholar).
  ecosia: {
    name: 'Ecosia', letter: 'Ec', color: '#008009',
    url: (q, o) => `https://ac.ecosia.org/?type=list&mkt=${whHl(o)}-${whGl(o)}&q=${whEnc(q)}`,
    parse: whParseOpenSearch,
  },
  swisscows: {
    name: 'Swisscows', letter: 'Sw', color: '#e30613',
    url: (q, o) => `https://api.swisscows.com/suggest?locale=${whHl(o)}-${whGl(o).toUpperCase()}&query=${whEnc(q)}`,
    parse: (data) => whList(data, (k) => k),
  },
  tiktok: {
    name: 'TikTok', letter: 'Tk', color: '#fe2c55',
    url: (q, o) => `https://www.tiktok.com/api/search/general/sug/?aid=1988&region=${whGl(o).toUpperCase()}&language=${whHl(o)}&keyword=${whEnc(q)}`,
    parse: (data) => whList(data && data.sug_list, (e) => e.content),
  },
  scholar: {
    name: 'Google Scholar', letter: 'Sc', color: '#5f6368',
    url: (q, o) => `https://scholar.google.com/scholar_complete?hl=${whHl(o)}&q=${whEnc(q)}`,
    parse: (data) => whList(data && data.l, (k) => k),
  },
};
const WORDHOARD_SOURCE_HOSTS = ['suggestqueries.google.com', 'api.bing.com', 'duckduckgo.com', 'trends.google.com', 'www.walmart.com', 'autosug.ebay.com',
  'suggest.yandex.com', 'ac.search.naver.com', 'www.baidu.com', 'suggest.seznam.cz', 'ac.ecosia.org', 'api.swisscows.com', 'www.tiktok.com', 'scholar.google.com',
  'googleads.googleapis.com', 'www.googleapis.com', 'oauth2.googleapis.com', 'login.microsoftonline.com', 'adinsight.api.bingads.microsoft.com', 'clientcenter.api.bingads.microsoft.com',
  ...new Set(Object.values(WH_AMAZON).map(([h]) => h))];
// Is a source on? An explicit user choice wins; else its default for this market.
function whSourceOn(settings, id) {
  const def = WORDHOARD_SOURCES[id];
  if (!def) return false;
  const chosen = settings && settings.sources && settings.sources[id];
  if (typeof chosen === 'boolean') return chosen;
  return !!def.on || (Array.isArray(def.markets) && def.markets.includes(whGl(settings)));
}

// Expansion kinds: what gets appended or prepended to the seed before asking each source.
const WORDHOARD_KINDS = {
  seed: { name: 'Seed', make: (s) => [s] },
  letters: { name: 'A to Z', make: (s) => 'abcdefghijklmnopqrstuvwxyz'.split('').map((l) => `${s} ${l}`) },
  questions: { name: 'Questions', make: (s) => ['who', 'what', 'when', 'where', 'why', 'how', 'which', 'can', 'does', 'is', 'are', 'will', 'should'].map((w) => `${w} ${s}`) },
  prepositions: { name: 'Prepositions', make: (s) => ['for', 'with', 'without', 'to', 'near', 'vs', 'versus', 'like', 'and', 'or'].map((w) => `${s} ${w}`) },
  modifiers: { name: 'Modifiers', make: (s) => [...['best', 'free', 'cheap', 'top'].map((w) => `${w} ${s}`), ...['review', 'alternative', 'online', 'price', 'cost', 'near me', String(new Date().getFullYear())].map((w) => `${s} ${w}`)] },
};
const WH_QUESTION_WORDS = /^(who|what|when|where|why|how|which|can|could|does|do|did|is|are|was|were|will|would|should)\b/i;

// The queries to send for a seed: [{ q, kind }] with duplicates removed.
function whExpansions(seed, kinds) {
  const s = whNormalize(seed);
  if (!s) return [];
  const out = [], seen = new Set();
  for (const kind of kinds) {
    const def = WORDHOARD_KINDS[kind];
    if (!def) continue;
    for (const q of def.make(s)) { const n = whNormalize(q); if (!seen.has(n)) { seen.add(n); out.push({ q, kind }); } }
  }
  return out;
}
function whNormalize(k) { return String(k || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function whWords(k) { const n = whNormalize(k); return n ? n.split(' ').length : 0; }
function whIsQuestion(k) { return WH_QUESTION_WORDS.test(whNormalize(k)); }

// ---------- singular / plural ----------
// Enough of pluralize's rules (plurals/pluralize, MIT) to merge "running shoes" with "running shoe". Only the
// last word is singularised, so "shoes for running" stays apart from "shoe for running".
const WH_UNCOUNTABLE = new Set(['news', 'series', 'species', 'fish', 'sheep', 'deer', 'moose', 'glasses', 'sunglasses', 'clothes', 'pants', 'jeans', 'shorts', 'leggings', 'tights',
  'scissors', 'headphones', 'earbuds', 'analytics', 'physics', 'mathematics', 'economics', 'politics', 'ethics', 'mechanics', 'statistics', 'logistics', 'graphics', 'electronics',
  'cosmetics', 'means', 'chess', 'tennis', 'cannabis', 'diabetes', 'measles', 'rabies', 'christmas', 'plus', 'minus', 'bonus', 'campus', 'status', 'focus', 'virus', 'bus', 'gas',
  'lens', 'canvas', 'atlas', 'bias', 'yes', 'this', 'his', 'its', 'us', 'ios', 'windows', 'vegas', 'texas', 'kansas', 'paris', 'games', 'stairs', 'savings', 'thanks', 'woods', 'arms', 'goods']);
const WH_IE_PLURALS = /^(?:p|l|t|d|zomb|cook|mov|rook|self|smooth|hood|gen|hipp|newb|food|brown|vegg|good|ind|cut|freeb|group|talk|walk|bird|calor|prair|lass|coll|goal|aunt|yupp)ies$/;
function whSingular(word) {
  const w = String(word || '').toLowerCase();
  if (w.length < 4 || WH_UNCOUNTABLE.has(w) || !/s$/.test(w)) return w;
  if (/(ss|us|is|ics|ous|eus|ius)$/.test(w)) return w;
  if (/(wi|kni|li)ves$/.test(w)) return w.replace(/ves$/, 'fe');
  if (/(ar|al|ol|ea|eo|oa|hoo|el|ee|ie|ir|ur|ur)ves$/.test(w) && !/lives$/.test(w)) return w.replace(/ves$/, 'f');
  if (/(mon|smil)ies$/.test(w)) return w.replace(/ies$/, 'ey');
  if (WH_IE_PLURALS.test(w)) return w.replace(/ies$/, 'ie');
  if (/[^aeiou]ies$/.test(w)) return w.replace(/ies$/, 'y');
  if (/(ch|sh|x|z|ss|tto|go|cho|hero|potato|tomato|alias|t[lm]as|gas|[aeiou]ris)es$/.test(w)) return w.replace(/es$/, '');
  if (/(analy|diagno|parenthe|progno|synop|the|empha|cri|ne)ses$/.test(w)) return w.replace(/ses$/, 'sis');
  if (/(movie|abuse|house|mouse|cheese|horse|nurse|purse|course|case|base|vase|phase|phrase|rose|nose|pose|dose|hose|use|fuse|muse|clause|pause|cause|lease|release|increase|decrease|disease|cruise|noise|poise|praise|promise|surprise|exercise|franchise|merchandise|enterprise|expertise|paradise|premise|tortoise|porpoise|browse|blouse|louse|spouse|grouse|moose|goose|loose|choose|expense|license|sense|tense|dense|defense|offense|response|nonsense|suspense|expense|mousse|pulse|impulse|converse|universe|verse|adverse|reverse|diverse|sparse|coarse|hoarse|morse|remorse|endorse|worse|else|false|lapse|collapse|eclipse|glimpse|synapse|corpse|tipsy)s$/.test(w)) return w.replace(/s$/, '');
  if (/[^s]s$/.test(w)) return w.replace(/s$/, '');
  return w;
}
// The merge key of a keyword: normalised, last word singular.
function whMergeKey(k) {
  const n = whNormalize(k);
  if (!n) return n;
  const words = n.split(' ');
  const last = words[words.length - 1];
  if (/^\d+$/.test(last)) return n;
  words[words.length - 1] = whSingular(last);
  return words.join(' ');
}

// ---------- intent ----------
// Whole-word lists (shahruk-maharuj/openkeyword, MIT), checked in this priority.
const WH_INTENT = [
  ['transactional', ['buy', 'price', 'prices', 'pricing', 'cost', 'cheap', 'cheapest', 'deal', 'deals', 'discount', 'coupon', 'coupons', 'order', 'for sale', 'near me', 'hire', 'quote', 'free shipping', 'subscription', 'download', 'book', 'booking', 'shop', 'purchase', 'sale', 'rent', 'rental']],
  ['commercial', ['best', 'top', 'review', 'reviews', 'vs', 'versus', 'compare', 'comparison', 'alternative', 'alternatives', 'rated', 'recommended', 'worth it', 'brands', 'brand', 'cheap vs', 'ranking', 'rankings']],
  ['navigational', ['login', 'log in', 'sign in', 'sign up', 'official site', 'official website', 'customer service', 'phone number', 'contact number', 'my account', 'account login', 'portal']],
  ['informational', ['how', 'what', 'why', 'when', 'where', 'who', 'which', 'can', 'does', 'is', 'are', 'guide', 'tutorial', 'examples', 'example', 'meaning', 'definition', 'ideas', 'tips', 'learn', 'steps', 'benefits', 'history', 'recipe', 'diy', 'explained']],
].map(([id, words]) => [id, new RegExp(`(?:^|\\s)(?:${words.map((w) => w.replace(/\s+/g, '\\s+')).join('|')})(?=\\s|$)`)]);
const WH_INTENT_NAMES = { transactional: 'Transactional', commercial: 'Commercial', navigational: 'Navigational', informational: 'Informational', other: 'Other' };
// Short labels for the intent column, in plain words.
const WH_INTENT_SHORT = { transactional: 'buy', commercial: 'compare', navigational: 'site', informational: 'learn', other: '' };
const WH_INTENT_HELP = { transactional: 'Buy: ready to purchase or book', commercial: 'Compare: weighing options before buying', navigational: 'Site: looking for a specific site or login', informational: 'Learn: wants an answer or a how-to', other: '' };
function whIntent(k) {
  const n = whNormalize(k);
  // a question is someone asking, whatever words follow ("is launching an app profitable")
  if (WH_QUESTION_WORDS.test(n) && !/\b(buy|price|prices|cost|cheap|cheapest|for sale|coupon|discount)\b/.test(n)) return 'informational';
  for (const [id, re] of WH_INTENT) if (re.test(n)) return id;
  return 'other';
}
// Search operators that leak into related-search links ("site:", "intitle:" …) are not keywords.
const WH_OPERATOR = /(^|\s)-?(site|intitle|allintitle|inurl|allinurl|filetype|ext|related|cache|inanchor|intext|before|after):/;
function whIsKeyword(k) { const n = whNormalize(k); return !!n && n.length <= 120 && !WH_OPERATOR.test(n) && !/^\w+:\/\//.test(n); }

// ---------- SERP intent from result URLs ----------
// First match wins (HasData/python-for-seo, idea): the page types a results page points to say what Google
// thinks the query wants.
const WH_SERP_RULES = [
  ['encyclopedic', (h) => h.endsWith('wikipedia.org')],
  ['video', (h) => h.endsWith('youtube.com') || h === 'youtu.be' || h.endsWith('vimeo.com') || h.endsWith('tiktok.com')],
  ['ugc', (h, p) => h.endsWith('reddit.com') || h.endsWith('quora.com') || h.endsWith('stackoverflow.com') || h.endsWith('stackexchange.com') || /\/(forum|forums|threads|community|board|discussion)s?(\/|$)/.test(p)],
  ['brand', (h, p) => p === '' || p === '/'],
  ['product', (h, p) => h.endsWith('amazon.com') || h.endsWith('ebay.com') || h.endsWith('walmart.com') || h.endsWith('etsy.com') || /\/(product|products|shop|item|items|collections|buy|pricing|store|dp|p)(\/|$)/.test(p)],
  ['informational', (h, p) => /\/(blog|blogs|guide|guides|news|article|articles|how-to|howto|tips|wiki|learn|resources|faq|questions)(\/|$)/.test(p) || /how-to|what-is|-guide|-tips/.test(p)],
];
const WH_SERP_NAMES = { encyclopedic: 'encyclopedia', video: 'video', ugc: 'forum', brand: 'brand homepage', product: 'product', informational: 'informational', page: 'other' };
function whSerpType(url) {
  let u;
  try { u = new URL(url); } catch { return 'page'; }
  const h = u.hostname.toLowerCase().replace(/^www\./, ''), p = u.pathname.toLowerCase().replace(/\/+$/, '');
  for (const [id, test] of WH_SERP_RULES) if (test(h, p)) return id;
  return 'page';
}
// Counts per type and the dominant type; `domains` is the number of distinct hosts.
function whSerpSummary(urls) {
  const counts = {}, hosts = new Set();
  for (const url of urls) {
    const t = whSerpType(url); counts[t] = (counts[t] || 0) + 1;
    try { hosts.add(new URL(url).hostname.replace(/^www\./, '')); } catch { /* skip */ }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return { counts, dominant: sorted.length ? sorted[0][0] : null, domains: hosts.size, total: urls.length };
}

// Plain-language read of the page inputs: varied sites and few exact titles leave room for a new page.
function whSerpRead(s) {
  if (!s || !s.total) return null;
  const variety = s.domains / s.total, exactShare = s.exact / s.total;
  if (variety >= 0.7 && exactShare <= 0.3) return { level: 'open', text: 'Looks open: many different sites and few exact-title pages.' };
  if (variety <= 0.5 || exactShare >= 0.7) return { level: 'crowded', text: 'Looks crowded: a few sites or many pages built for this exact query.' };
  return { level: 'mixed', text: 'Mixed: some variety, some pages aimed at this query.' };
}

// ---------- word frequency prior (optional data file) ----------
// zipf table: { word: zipf } for words at Zipf >= 3 (wordfreq, CC-BY-SA). Unknown words count as very rare.
const WH_ZIPF_FLOOR = 1.5, WH_ZIPF_WEIGHT = 100;
const WH_ZIPF_STOP = new Set(['a', 'an', 'the', 'for', 'to', 'of', 'in', 'on', 'and', 'or', 'with', 'my', 'your', 'i', 'you', 'is', 'are', 'do', 'does', 'can', 'vs', 'near', 'me', 'at', 'by', 'from', 'how', 'what', 'why', 'when', 'where', 'who', 'which', 'will', 'should', 'without', 'like', 'versus', 'best', 'free', 'cheap', 'top']);
// The Zipf of the rarest content word a keyword adds beyond the seed, or null when it adds none.
function whZipfOf(k, seed, table) {
  if (!table) return null;
  const seedWords = new Set(whNormalize(seed).split(' '));
  let min = null;
  for (const w of whNormalize(k).split(' ')) {
    if (seedWords.has(w) || WH_ZIPF_STOP.has(w) || /^\d+$/.test(w)) continue;
    const z = table[w] ?? WH_ZIPF_FLOOR;
    min = min == null ? z : Math.min(min, z);
  }
  return min;
}

// ---------- merge and rank ----------
// Merges the answers of many requests into one keyword list.
//   results: [{ source, q, kind, items: [{ k, r, z? }] }]  →  [{ k, key, sources: [..], r, score, hits, kinds: [..], words, question, intent, seed }]
// r is Google's relevance when Google suggested it (higher = more popular; 1250 is the cap), else null.
// Relevance is relative to the prefix that was typed, so the top answer to "is <seed>" scores as high as the top
// answer to the seed itself. The ranking score therefore weights by expansion kind and rewards a keyword that
// several sources or expansions agree on.
const WH_KIND_WEIGHT = { seed: 1, letters: 0.75, trends: 0.7, deeper: 0.7, questions: 0.6, prepositions: 0.6, modifiers: 0.6 };
const WH_UNSCORED = 300; // what a suggestion from a source without relevance counts as
// Every word beyond the seed plus one makes a keyword more specific and, measured against Google Trends, less
// searched: Spearman vs Trends went from 0.47 to 0.65 with this term (Wordhoard benchmark).
const WH_EXTRA_WORD = 300;
function whMerge(results, seed) {
  const map = new Map();
  const seedN = whNormalize(seed);
  const seedWords = whWords(seedN);
  for (const res of results) {
    if (!res || !Array.isArray(res.items)) continue;
    const w = WH_KIND_WEIGHT[res.kind] ?? 0.6;
    res.items.forEach((item, i) => {
      const form = whNormalize(item.k);
      if (!form) return;
      const key = whMergeKey(form);
      let row = map.get(key);
      if (!row) {
        row = { k: form, key, forms: new Map(), sources: [], r: null, z: null, score: 0, hits: 0, kinds: [], rank: Infinity, words: whWords(form), question: whIsQuestion(form), intent: whIntent(form), seed: seedN ? form.includes(seedN) : true };
        map.set(key, row);
      }
      row.forms.set(form, (row.forms.get(form) || 0) + 1);
      if (!row.sources.includes(res.source)) row.sources.push(res.source);
      if (res.kind && !row.kinds.includes(res.kind)) row.kinds.push(res.kind);
      if (item.r != null) row.r = row.r == null ? item.r : Math.max(row.r, item.r);
      if (item.z != null) row.z = row.z == null ? item.z : Math.min(row.z, item.z);
      row.score = Math.max(row.score, (item.r != null ? item.r : WH_UNSCORED) * w - i * 15);
      row.hits++;
      row.rank = Math.min(row.rank, i);
    });
  }
  for (const row of map.values()) {
    // show the form people type most; ties go to the shorter one
    let best = row.k, bestN = -1;
    for (const [form, n] of row.forms) if (n > bestN || (n === bestN && form.length < best.length)) { best = form; bestN = n; }
    row.k = best; row.words = whWords(best); row.question = whIsQuestion(best); row.intent = whIntent(best);
    row.variants = row.forms.size;
    delete row.forms;
    row.score = Math.round(row.score + 150 * (row.sources.length - 1) + 60 * (row.hits - 1) - WH_EXTRA_WORD * Math.max(0, row.words - seedWords - 1)
      + (row.z != null ? WH_ZIPF_WEIGHT * (Math.min(row.z, 5) - 4) : 0));
  }
  return [...map.values()].sort(whCompare);
}
// Most popular first.
function whCompare(a, b) {
  if (a.score !== b.score) return b.score - a.score;
  if (a.rank !== b.rank) return a.rank - b.rank;
  return a.k < b.k ? -1 : a.k > b.k ? 1 : 0;
}

// ---------- CSV ----------
// CSV with RFC 4180 quoting; rows are arrays, the first row the header. Keywords come from third parties, so a
// cell that a spreadsheet would run as a formula (=, +, -, @, tab, CR first) gets a leading apostrophe.
function whCsv(rows) {
  const cell = (v) => {
    let s = v == null ? '' : String(v);
    // Numbers cannot be formulas, so a negative change stays a number; text that starts like a formula is neutralised.
    if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
function whRowsToCsv(rows) {
  return whCsv([['keyword', 'sources', 'google_relevance', 'popularity', 'trend_12m', 'intent', 'volume', 'competition', 'cpc_low', 'cpc_high', 'change_12m', 'bing_volume', 'site_impressions', 'youtube_views', 'words', 'question', 'monthly_12m', 'ad_value_month', 'easy_win', 'score', 'stands_out'],
    ...rows.map((r) => [r.k, (r.sources || []).join(' '), r.r ?? '', r.score ?? '', r.trend ?? '', r.intent ?? whIntent(r.k), r.volume ?? '', r.competition ?? '', r.cpcLow ?? '', r.cpcHigh ?? '',
      r.chg ?? '', r.bing ?? '', r.site ?? '', r.yt ?? '', r.words ?? whWords(r.k), r.question ? 'yes' : '', (r.monthly || []).join(' '),
      r.value != null ? Math.round(r.value) : '', r.win != null ? Math.round(r.win) : '', r.best ?? '', r.odd || ''])]);
}

// ---------- Google Trends helpers ----------
// Google Trends answers with an anti-JSON prefix before the JSON.
function whTrendsJson(text) {
  const i = text.indexOf('{');
  if (i < 0) throw new Error('trends: no JSON');
  return JSON.parse(text.slice(i));
}
// The multiline widget's points → { avg (0–100), last, spark: [n numbers] }
function whTrendsSummary(multiline) {
  const pts = multiline && multiline.default && Array.isArray(multiline.default.timelineData) ? multiline.default.timelineData : [];
  const vals = pts.map((p) => Number(p.value && p.value[0])).filter((v) => Number.isFinite(v));
  if (!vals.length) return null;
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  return { avg, last: vals[vals.length - 1], spark: vals };
}

// ---------- Google Ads constants ----------
// Keyword Planner wants geoTargetConstants/<2000 + ISO 3166 numeric> and languageConstants/<criterion id>.
const WH_ISO_NUMERIC = { us: 840, uk: 826, gb: 826, ca: 124, au: 36, ie: 372, nz: 554, in: 356, de: 276, at: 40, ch: 756, fr: 250, es: 724, it: 380, nl: 528, be: 56, pt: 620,
  pl: 616, se: 752, no: 578, dk: 208, fi: 246, cz: 203, gr: 300, tr: 792, ro: 642, hu: 348, br: 76, mx: 484, ar: 32, cl: 152, co: 170, jp: 392, kr: 410, sg: 702, ph: 608,
  id: 360, my: 458, th: 764, vn: 704, za: 710, ng: 566, eg: 818, ae: 784, sa: 682, il: 376, ru: 643, ua: 804, kz: 398, by: 112, cn: 156 };
const WH_ADS_LANGUAGE = { en: 1000, de: 1001, fr: 1002, es: 1003, it: 1004, ja: 1005, da: 1009, nl: 1010, fi: 1011, ko: 1012, no: 1013, pt: 1014, sv: 1015, zh: 1017, ar: 1019,
  bg: 1020, cs: 1021, el: 1022, hi: 1023, hu: 1024, id: 1025, is: 1026, he: 1027, lv: 1028, lt: 1029, pl: 1030, ru: 1031, ro: 1032, sk: 1033, sl: 1034, sr: 1035, uk: 1036,
  tr: 1037, ca: 1038, hr: 1039, vi: 1040, ur: 1041, tl: 1042, et: 1043, th: 1044, bn: 1056, fa: 1064, ms: 1102 };
function whAdsGeo(gl) { const n = WH_ISO_NUMERIC[whGl({ gl })]; return n ? `geoTargetConstants/${2000 + n}` : null; }
function whAdsLanguage(hl) { const n = WH_ADS_LANGUAGE[whHl({ hl })]; return n ? `languageConstants/${n}` : null; }
// One Keyword Planner metrics result → the fields a row shows.
const WH_MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
function whAdsMetric(result) {
  const m = (result && (result.keywordMetrics || result.keywordIdeaMetrics)) || {};
  const micros = (v) => (v == null ? null : Math.round(Number(v) / 10000) / 100);
  // monthlySearchVolumes: [{ year: '2026', month: 'OCTOBER', monthlySearches: '1900' }], oldest first after sorting.
  const months = (m.monthlySearchVolumes || [])
    .map((x) => ({ at: Number(x.year) * 12 + Math.max(0, WH_MONTHS.indexOf(String(x.month).toUpperCase())), n: x.monthlySearches != null ? Number(x.monthlySearches) : null }))
    .filter((x) => Number.isFinite(x.at) && x.n != null && Number.isFinite(x.n)).sort((a, b) => a.at - b.at).slice(-12);
  const monthly = months.map((x) => x.n);
  // Change over the year: the last 3 months against the first 3, so one odd month does not swing it.
  const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const change = monthly.length >= 6 && avg(monthly.slice(0, 3)) > 0 ? Math.round((avg(monthly.slice(-3)) / avg(monthly.slice(0, 3)) - 1) * 100) : null;
  return { k: whNormalize(result && result.text), volume: m.avgMonthlySearches != null ? Number(m.avgMonthlySearches) : null, competition: m.competition || null,
    competitionIndex: m.competitionIndex != null ? Number(m.competitionIndex) : null, cpcLow: micros(m.lowTopOfPageBidMicros), cpcHigh: micros(m.highTopOfPageBidMicros),
    monthly, firstMonth: months.length ? months[0].at : null, change };
}
// Bids come in the Ads account's currency; without a known currency they show as plain numbers.
function whMoney(v, currency) {
  if (v == null || !Number.isFinite(Number(v))) return '';
  if (currency) { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: v >= 100 ? 0 : 2 }).format(v); } catch { /* unknown code */ } }
  return Number(v).toFixed(2);
}
function whMoneyShort(v, currency) {
  if (v == null || !Number.isFinite(Number(v))) return '';
  try { return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: v >= 100 ? 0 : 1, ...(currency ? { style: 'currency', currency } : {}) }).format(v); } catch { return String(Math.round(v)); }
}

// ---------- several seeds in one search ----------
// "running shoes, trail shoes" → up to five seeds; each is expanded on its own and the ideas are merged.
const WH_MAX_SEEDS = 5;
function whSeeds(input) {
  return [...new Set(String(input || '').split(/[,;\n]+/).map(whNormalize).filter(Boolean))].slice(0, WH_MAX_SEEDS);
}
// Results carry the seed they were asked for; each seed is ranked against itself, then the lists join.
function whMergeSeeds(results, seeds) {
  const list = (seeds || []).map(whNormalize).filter(Boolean);
  if (list.length <= 1) return whMerge(results, list[0] || '').filter((r) => r.k !== list[0]).map((r) => { r.seed = list[0] || ''; return r; });
  const by = new Map();
  for (const seed of list) {
    for (const r of whMerge(results.filter((x) => x && (x.seed || list[0]) === seed), seed)) {
      if (list.includes(r.k)) continue;
      r.seed = seed;
      const key = r.key || r.k, had = by.get(key);
      if (!had) { by.set(key, r); continue; }
      const best = (r.score || 0) > (had.score || 0) ? r : had, other = best === r ? had : r;
      best.sources = [...new Set([...(best.sources || []), ...(other.sources || [])])];
      best.hits = (best.hits || 0) + (other.hits || 0);
      by.set(key, best);
    }
  }
  return [...by.values()].sort(whCompare);
}

// ---------- what the numbers add up to ----------
// From Keyword Planner numbers on the rows (volume, cpcLow, cpcHigh, competition, competitionIndex, chg) this adds:
//   value  monthly ad value = searches × typical bid: what advertisers would pay for those clicks ("where the money is")
//   win    value discounted by competition: money that few advertisers chase ("easy wins")
//   rise   12-month change, for keywords with real volume ("rising")
//   odd    why a keyword is unlike the rest of the list, by robust z-score (median and MAD) of volume, bid and change
//   best   0–100: its rank in the list on value (45 %), easy win (35 %) and rise (20 %)
// and returns the totals for the whole list and the top keyword of each kind.
const WH_COMP_INDEX = { LOW: 20, MEDIUM: 50, HIGH: 85 };
function whMedian(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function whInsights(rows) {
  const data = [];
  for (const r of rows) {
    r.value = r.win = r.rise = r.best = r.oddZ = undefined; r.odd = '';
    if (r.volume == null) continue;
    const cpc = r.cpcLow != null && r.cpcHigh != null ? (r.cpcLow + r.cpcHigh) / 2 : (r.cpcHigh ?? r.cpcLow ?? null);
    r.cpcMid = cpc;
    if (cpc != null) {
      r.value = r.volume * cpc;
      const ci = r.competitionIndex ?? WH_COMP_INDEX[r.competition] ?? 50;
      r.win = r.value * (1 - Math.min(100, Math.max(0, ci)) / 100);
    }
    if (r.chg != null && r.volume >= 50) r.rise = r.chg;
    data.push(r);
  }
  const totals = { n: rows.length, withData: data.length, searches: 0, value: 0, cpc: null };
  let paidVolume = 0;
  for (const r of data) { totals.searches += r.volume; if (r.value != null) { totals.value += r.value; paidVolume += r.volume; } }
  totals.cpc = paidVolume ? totals.value / paidVolume : null;

  // rank in the list, 0..1 (ties share the lower rank)
  const rank = (field) => {
    const vals = data.filter((r) => r[field] != null).map((r) => r[field]).sort((a, b) => a - b);
    return (v) => {
      if (v == null || vals.length < 2) return null;
      let lo = 0, hi = vals.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (vals[mid] < v) lo = mid + 1; else hi = mid; }
      return lo / (vals.length - 1);
    };
  };
  const rv = rank('value'), rw = rank('win'), rr = rank('rise');
  for (const r of data) {
    if (r.value == null) continue;
    const a = rv(r.value), b = rw(r.win), c = rr(r.rise);
    if (a == null) continue;
    r.best = Math.round(100 * (0.45 * a + 0.35 * (b ?? a) + 0.2 * (c ?? 0.5)));
  }

  // unlike the rest: robust z-scores, only with enough rows to say what "the rest" is
  if (data.length >= 8) {
    const z = (get) => {
      const xs = data.map(get).filter((x) => x != null && Number.isFinite(x));
      const med = whMedian(xs);
      const mad = xs.length ? whMedian(xs.map((x) => Math.abs(x - med))) * 1.4826 : 0;
      return { med, f: (x) => (x == null || !mad ? 0 : (x - med) / mad) };
    };
    const lv = (r) => Math.log10(r.volume + 1), lc = (r) => (r.cpcMid > 0 ? Math.log10(r.cpcMid) : null);
    const zv = z(lv), zc = z(lc), zr = z((r) => r.rise ?? null);
    const medVol = whMedian(data.map((r) => r.volume)), medCpc = whMedian(data.filter((r) => r.cpcMid > 0).map((r) => r.cpcMid));
    const times = (x) => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10);
    for (const r of data) {
      const cand = [
        [zv.f(lv(r)), () => (medVol > 0 ? `${times(r.volume / medVol)}× the usual volume` : 'far more searches')],
        [zc.f(lc(r)), () => (medCpc > 0 ? `bid ${times(r.cpcMid / medCpc)}× the usual` : 'far higher bid')],
        [r.rise != null && r.rise > 0 ? zr.f(r.rise) : 0, () => `up ${r.rise}%`],
      ].sort((a, b) => b[0] - a[0])[0];
      if (cand[0] >= 2.5) { r.oddZ = Math.round(cand[0] * 10) / 10; r.odd = cand[1](); }
    }
  }
  const top = (field, skip) => data.filter((r) => r[field] != null && r[field] > 0 && !(skip || []).includes(r)).sort((a, b) => b[field] - a[field] || whCompare(a, b))[0] || null;
  const money = top('value'), win = top('win', [money]) || top('win');
  return { totals, picks: { money, win, rise: top('rise'), odd: top('oddZ') } };
}
function whMonthName(at) { return new Date(Math.floor(at / 12), at % 12, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }); }

Object.assign(globalThis, { WORDHOARD_SOURCES, WORDHOARD_SOURCE_HOSTS, WORDHOARD_KINDS, WH_INTENT_NAMES, WH_INTENT_SHORT, WH_INTENT_HELP, whIsKeyword, whSerpRead, WH_SERP_NAMES, WH_ZIPF_WEIGHT, whSourceOn, whExpansions, whNormalize, whWords, whIsQuestion,
  whSingular, whMergeKey, whIntent, whSerpType, whSerpSummary, whZipfOf, whMerge, whCompare, whCsv, whRowsToCsv, whTrendsJson, whTrendsSummary, whParseChrome, whParseOpenSearch, whParseAmazon,
  whAdsGeo, whAdsLanguage, whAdsMetric, whMoney, whMoneyShort, whMonthName, whSeeds, whMergeSeeds, whInsights, WH_MAX_SEEDS });
