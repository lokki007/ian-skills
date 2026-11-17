// Deterministic frame-by-frame renderer for GSAP pages that expose window.__seek/__duration/__ready.
// Run from the project folder:
//   node <skill>/scripts/render.mjs src/v1.html --stills 3,8.5,20      -> stills/v1-<t>.png
//   node <skill>/scripts/render.mjs src/v1.html --out build/v1-silent.mp4 [--fps 60] [--workers 5]
import { createRequire } from "node:module";
import { spawn, execSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

// Find Playwright: the project folder first, then the global npm install.
function loadPlaywright() {
  const bases = [join(process.cwd(), "noop.js")];
  try { bases.push(join(execSync("npm root -g").toString().trim(), "noop.js")); } catch {}
  for (const b of bases) {
    try { return createRequire(b)("playwright"); } catch {}
  }
  console.error("playwright not found. Run `npm i -g playwright && npx playwright install chromium` (or install it in the project folder).");
  process.exit(1);
}
const { chromium } = loadPlaywright();

const args = process.argv.slice(2);
const page = resolve(process.cwd(), args[0]);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const url = pathToFileURL(page).href + "?render";
const name = basename(page, ".html");

async function openPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.error("pageerror:", e.message));
  await p.goto(url, { waitUntil: "networkidle" });
  await p.evaluate(() => window.__ready);
  return p;
}

async function stills(times) {
  const browser = await chromium.launch();
  const p = await openPage(browser);
  const dir = resolve(process.cwd(), opt("--dir", "stills")); mkdirSync(dir, { recursive: true });
  for (const t of times) {
    await p.evaluate((t) => window.__seek(t), t);
    const f = join(dir, `${name}-${t.toFixed(1).padStart(5, "0")}.png`);
    await p.screenshot({ path: f });
    console.log(f);
  }
  await browser.close();
}

async function renderChunk(browser, start, end, fps, file) {
  const p = await openPage(browser);
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p", "-r", String(fps), file], { stdio: ["pipe", "inherit", "inherit"] });
  for (let f = start; f < end; f++) {
    await p.evaluate((t) => window.__seek(t), f / fps);
    const buf = await p.screenshot({ type: "png" });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  await new Promise((r, j) => ff.on("close", (c) => (c === 0 ? r() : j(new Error("ffmpeg " + c)))));
}

async function render(out, fps, workers) {
  mkdirSync(dirname(out), { recursive: true });
  const browser = await chromium.launch();
  const probe = await openPage(browser);
  const dur = await probe.evaluate(() => window.__duration);
  await probe.context().close();
  const total = Math.ceil(dur * fps);
  const tmp = join(dirname(out), ".chunks-" + basename(out, ".mp4")); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
  const per = Math.ceil(total / workers);
  const files = [];
  const t0 = Date.now();
  await Promise.all(Array.from({ length: workers }, (_, i) => {
    const s = i * per, e = Math.min(total, s + per);
    const f = join(tmp, `c${i}.mp4`); files.push(f);
    return renderChunk(browser, s, e, fps, f).then(() => console.log(`chunk ${i} done (${s}-${e}) ${((Date.now() - t0) / 1000).toFixed(0)}s`));
  }));
  await browser.close();
  const list = join(tmp, "list.txt");
  writeFileSync(list, files.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"));
  await new Promise((r, j) => spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", out], { stdio: "inherit" })
    .on("close", (c) => (c === 0 ? r() : j(new Error("concat " + c)))));
  rmSync(tmp, { recursive: true, force: true });
  console.log(`wrote ${out} · ${total} frames · ${dur.toFixed(2)}s · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

if (args.includes("--stills")) await stills(opt("--stills").split(",").map(Number));
else await render(resolve(process.cwd(), opt("--out", `build/${name}-silent.mp4`)), +opt("--fps", 60), +opt("--workers", 5));
