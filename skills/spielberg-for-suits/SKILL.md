---
name: spielberg-for-suits
description: Make slick, narrated motion-graphics explainer videos (1080p60 MP4) that sell an idea to leadership — "before vs after AI" process visualizers, product/demo explainers, pitch videos. GSAP scenes in HTML rendered frame-by-frame with Playwright, AI voiceover (OpenAI TTS), procedural music synced to scene changes, ducked and mastered with ffmpeg. Use when asked for an explainer video, demo/visualizer video, animated pitch, "a video with slick motion", or to add narration/music to such a video.
license: MIT
---

# Spielberg for Suits

Code-driven explainer videos: every scene is HTML/CSS animated by one paused GSAP timeline, so any frame renders deterministically. `examples/` holds two finished pitch videos for a fictional company (a "shipping inbox autopilot" and a "warehouse receiving" follow-up).

## Requirements

- **Node 18+** with Playwright and its Chromium: `npm i -g playwright && npx playwright install chromium`. `render.mjs` looks in the project folder first, then the global npm root.
- **ffmpeg + ffprobe** on PATH.
- **Python 3.9+** with `numpy` and `openai` (`pip install numpy openai`).
- **Environment variables:**

| Variable | Needed for | Notes |
|---|---|---|
| `OPENAI_API_KEY` | `tts.py`, `qa.py vo` | Required for narration and the transcription check. Not needed for silent videos, `music.py`, `mix.py`, `render.mjs` or the other `qa.py` checks. |
| `OPENAI_BASE_URL` | same | Optional. Points the OpenAI SDK at a compatible proxy or gateway. |

No other services are used. Music is synthesized locally by `music.py`, so there is nothing to license. Fonts load from Google Fonts at render time (needs network). Third-party licenses: `THIRD_PARTY_NOTICES.md`.

## Pipeline

```
storyboard → scaffold → build scenes → stills review loop → narration (tts) → fit timing → render silent → music → mix → QA → deliver
```

`SK` = this skill's folder. Run commands from the project folder.

1. **Storyboard first (in chat or a scratch file).** For each video: 5–8 scenes, each with one job, one caption (≤2 lines), one narration line (≤ ~30 words), and the visual. Classic arc: hook title → the messy reality → today's manual cost → the AI mechanism (show *how*: what it reads, what it extracts) → rules/routing → result with a human confirming → payoff end card (+ "what we need to pilot it"). Two related videos should share data so the second can reference the first.
2. **Scaffold:** `python SK/scripts/new_project.py <dir> v1 [v2] --title "Shipping inbox autopilot" --brand "Acme"` → `src/` (common.css/js, GSAP vendor, starter HTML) + `v1.json`.
3. **Build scenes** in `src/v1.html` (start from `starter.html`; borrow components from `examples/`). Set the design-time `T = {...}` marks and mirror them as `mark` in `v1.json` (plus `design_total`, each scene's `vo` text and `music` section).
4. **Stills loop** until it looks right: `node SK/scripts/render.mjs src/v1.html --stills 2.5,10,17,23,29,40,49,61,70`, then `python SK/scripts/qa.py sheet stills/sheet.jpg stills/v1-*.png` and view the sheet (or individual stills for detail). Fix overlaps, clipping, empty space, wrong z-order. Never skip this — first drafts always have collisions.
5. **Narration:** `python SK/scripts/tts.py v1.json` (voice `cedar`, gpt-4o-mini-tts; writes trimmed clips + `vo_dur`). Check pronunciation: `python SK/scripts/qa.py vo v1.json`. Regenerate one line: `tts.py v1.json <scene_key>`.
6. **Fit timing:** `python SK/scripts/fit.py v1.json` stretches any scene shorter than its line (+0.4s lead, +0.9s tail), writes `start`/`total` to the JSON and patches the `// @retime` line in the HTML. Re-shoot a few stills after.
7. **Render silent picture** (run it in the background; ~12–15 min per 75s at 5 workers): `node SK/scripts/render.mjs src/v1.html --out build/v1-silent.mp4`. Run multiple videos sequentially in one background command.
8. **Music:** `python SK/scripts/music.py v1.json` → `audio/v1/music.wav` (~1 min to synthesize).
9. **Mix + mux:** `python SK/scripts/mix.py v1.json` → `cfg.out` at -16 LUFS / -1.5 dBTP, music ducked ~10 dB under the voice.
10. **QA:** `python SK/scripts/qa.py audio 01-v1.mp4` (durations of both streams must match the picture; waveform shows full length). Pull 4 frames from the final MP4 into a sheet and view it. Then deliver the file and say what you could not verify (an agent cannot hear the audio).

Silent-only request? Stop after step 4, set `design_total`, and render straight to the final name.

To preview an example, scaffold a project and copy the example HTML into its `src/` (the examples expect `common.css`, `common.js` and `vendor/` next to them).

## Config (`v1.json`)

```json
{ "id": "v1", "html": "src/v1.html", "out": "01-v1.mp4", "voice": "cedar",
  "design_total": 73, "music": {"bpm": 96, "seed": 11},
  "scenes": [ {"key": "intro", "mark": 0, "music": "intro", "vo": "Every shipment sends us an email..."},
              {"key": "chaos", "mark": 5.5, "music": "tense", "vo": "..."} ] }
```
Optional: `voice_instructions`, `tts_model`, `vo_lead`, `vo_tail`, `music_db` (default -9). A sub-beat inside one scene that needs its own line is just another scene entry with its own `mark` (e.g. `readA` at 20, `readB` at 24.9).

Music sections: `intro` (pads) · `tense` (pads + plucked arp + clock ticks — the problem) · `lift` (first one gets riser + impact; kick/bass enter — the reveal) · `groove` · `full` (four-on-floor + hats) · `end` (groove stops, tonic chord rings out). Swooshes land on every other scene change automatically.

## Visual system (common.css / common.js)

- 1920×1080 stage, dark theme: bg `#08090b`, panels `#121418`, gold `--gold #cfaf40` = emphasis/brand, `--ai #8fa8ff` = the AI, green/amber/red = filed/needs-a-look/problem. Fonts: Manrope (UI), JetBrains Mono (data/kickers), Permanent Marker (handwriting). For a brand with its own colors, change the tokens in `:root`.
- Layout: brandmark top-left (y≈64), chapter bars top-right, content between y≈130–790, caption block bottom-left (kicker `01 / The problem` + 54px headline, gold `<em>` for key words, `.ai` for the AI's name).
- Helpers: `capIn/capOut(tl, sel, at)` (words rise out of blur), `type(tl, el, text, at, dur)`, `count(tl, el, from, to, at, dur, fmt)`, `chapters(tl, marks, total)`, `retime`, `boot`. Preview any page in a browser (scrubber; `?t=30&still` to freeze).
- Motion language: entrances `power3.out` 0.6–0.9s with y/blur, staggers 0.1–0.2s, `back.out` for chips/stamps, exits `power2.in` 0.45s ~0.5s before the next mark, slow ambient drift of grid/glows across the whole video. One idea moving at a time; captions arrive ~0.4s after the scene.
- Proven components in `examples/`: flooding inbox list, "where it hides" specimen cards, watchdog node with pulse rings + chips streaming in/out, document with scan beam + bounding boxes + callout tags, extraction card with typed fields + confidence ring + wires, rules panel with glowing rows + chips flying into lanes with counters, portal table + review card with cursor click, perspective phone photo that straightens, handwriting reveal via clip-path, trucks on MotionPath into a hub, end card with flow pills + "to pilot it" box.

## Rules that keep renders correct

- **Determinism:** everything is a tween on the master `tl` — no CSS animations/transitions, no `tl.call()`, no `Math.random()` (use the seeded `rnd()` pattern), no timers. Text/number changes go through `type`/`count` (onUpdate), so seeking backward works.
- Two tweens must not fight over one property (e.g. drift with `yPercent` while entrance uses `y`). A later `fromTo` on an already-animated property needs `immediateRender: false`.
- Staggered schedules must be monotonic (`at = base + span * Math.pow(i/(n-1), 0.62)` for an accelerating flood) — a formula that bends back makes rows arrive out of order.
- Measure positions with `offsetLeft/offsetTop` up to `#stage` (ignores transforms/scale); compute final positions, then animate *from* offsets.
- Keep callout tags/leader lines outside documents (no lines through content); start wires at the document edge. `overflow:hidden` clips callouts — wrap scan effects in an inner `.clip` instead.
- Put moving things *under* the card they arrive at (DOM order), and end their paths inside it.
- Retime remaps tween start times only (long tweens >2.5s are time-scaled), so after `fit.py` the scene's beats spread out evenly; if a stretched scene feels static, add a beat rather than lengthening tweens.
- Fonts load from Google Fonts; render waits on `document.fonts.ready`.
- Patch HTML/JSON with an editor tool or a Python script file rather than inline shell one-liners; shells can mangle regex backslashes and non-ASCII text.

## Honesty + content

- Example data is fictional; label volumes "illustrative" on screen and call out estimates ("≈ $100K a year (estimate)"). Don't present made-up per-step timings or metrics as measured.
- Don't use real company names as customers in fake data; real carriers/vendors as message senders are fine.
- Name the AI pieces the way the audience knows them (a specific model or internal tool name); if a named product is unverified, render it generically ("the AI", "rules engine") and say so.

## Audio notes

- TTS: `gpt-4o-mini-tts`, voice `cedar` reads as a calm leadership explainer; spell out tricky names in `voice_instructions` (e.g. "Say SKU as S K U"). Transcription QA uses `gpt-4o-mini-transcribe`.
- Narration paces ~2.4 words/s; budget scene length = words/2.4 + 1.3s, or let `fit.py` stretch.
- `music.py` is procedural so it works offline with no license questions. If you have access to a music-generation API, you can drop its output in as `audio/<id>/music.wav` instead; `mix.py` only needs that file to cover the full length.
- `mix.py` pads the narration track to full length — without it the sidechain ends at the last line and truncates the music.
- Delivery: MP4s are ~200 KB/s at 1080p60 crf 15. Email attachments often cap around 25 MB; re-encode at crf 20 or 30 fps if needed.
