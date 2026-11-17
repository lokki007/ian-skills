// Wordhoard's engine (sources.js) loaded headless. Uses the copy vendored next to this skill; set WORDHOARD_EXT
// to a Wordhoard extension folder (the one holding sources.js) to use a newer engine instead.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const CANDIDATES = [
  process.env.WORDHOARD_EXT,
  join(HERE, '..', 'vendor', 'wordhoard'),
].filter(Boolean);

let cached = null;
export function engine() {
  if (cached) return cached;
  const dir = CANDIDATES.find((d) => existsSync(join(d, 'sources.js')));
  if (!dir) throw new Error('Wordhoard sources.js not found');
  const ctx = vm.createContext({ URL, navigator: { language: 'en-US' }, console });
  vm.runInContext(readFileSync(join(dir, 'sources.js'), 'utf8'), ctx, { filename: 'wordhoard/sources.js', timeout: 2000 });
  const api = new Proxy({}, { get: (_, k) => vm.runInContext(String(k), ctx) });
  // Word-frequency table (optional): without it the engine leaves the frequency term out of the score.
  const zp = [join(dir, 'data', 'zipf-en.json'), join(dir, 'zipf-en.json')].find(existsSync);
  const zipf = zp ? {} : null;
  if (zp) {
    const buckets = JSON.parse(readFileSync(zp, 'utf8')).buckets ?? {};
    for (const [b, words] of Object.entries(buckets)) for (const w of words) zipf[w] = Number(b);
  }
  let version = 'vendored';
  try { version = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')).version; } catch { /* vendored copy has no manifest */ }
  cached = { api, zipf, dir, version };
  return cached;
}
