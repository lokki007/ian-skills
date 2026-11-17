// Shared motion helpers. Everything is a tween on one paused master timeline,
// so any frame can be rendered deterministically with tl.time(t).
(function () {
  const RENDER = new URLSearchParams(location.search).has("render");
  if (RENDER) document.body.classList.add("render");

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function fit() {
    const st = $("#stage");
    if (!st || RENDER) return;
    const s = Math.min(innerWidth / 1920, (innerHeight - 60) / 1080);
    st.style.transform = `scale(${s})`;
  }
  addEventListener("resize", fit);

  // Wrap each word of an element in .w spans (keeps inner <em>/<span> styling).
  function splitWords(el) {
    if (el.dataset.split) return $$(".w", el);
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const s = document.createElement("span");
            s.className = "w"; s.textContent = part; frag.appendChild(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && !n.classList.contains("w")) walk(n);
      });
    };
    walk(el);
    el.dataset.split = "1";
    return $$(".w", el);
  }

  // Caption in: kicker slides, headline words rise out of blur.
  function capIn(tl, sel, at) {
    const el = typeof sel === "string" ? $(sel) : sel;
    const k = $(".kicker", el), h = $(".h", el);
    const words = splitWords(h);
    tl.set(el, { autoAlpha: 1 }, at);
    if (k) tl.fromTo(k, { autoAlpha: 0, x: -24 }, { autoAlpha: 1, x: 0, duration: 0.6, ease: "power3.out" }, at);
    tl.fromTo(words, { autoAlpha: 0, y: 28, filter: "blur(10px)" },
      { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.7, ease: "power3.out", stagger: 0.045 }, at + 0.1);
    return tl;
  }
  function capOut(tl, sel, at) {
    const el = typeof sel === "string" ? $(sel) : sel;
    tl.to(el, { autoAlpha: 0, y: -16, filter: "blur(8px)", duration: 0.45, ease: "power2.in" }, at);
    tl.set(el, { y: 0, filter: "blur(0px)" }, at + 0.5);
    return tl;
  }

  // Deterministic typewriter.
  function type(tl, el, text, at, dur, opts = {}) {
    const o = { n: 0 };
    tl.set(el, { textContent: "" }, at - 0.001);
    tl.to(o, {
      n: text.length, duration: dur, ease: opts.ease || "none",
      onUpdate: () => { el.textContent = text.slice(0, Math.round(o.n)) + (opts.caret && o.n < text.length ? "▍" : ""); },
    }, at);
    return tl;
  }

  // Deterministic counter.
  function count(tl, el, from, to, at, dur, fmt = (v) => Math.round(v).toLocaleString("en-US")) {
    const o = { v: from };
    tl.set(el, { textContent: fmt(from) }, at - 0.001);
    tl.to(o, { v: to, duration: dur, ease: "power2.out", onUpdate: () => { el.textContent = fmt(o.v); } }, at);
    return tl;
  }

  function chapters(tl, marks, total) {
    const bars = $$(".chapters .ch i");
    marks.forEach((m, i) => {
      const end = marks[i + 1] ?? total;
      if (bars[i]) tl.fromTo(bars[i], { scaleX: 0 }, { scaleX: 1, duration: end - m, ease: "none" }, m);
    });
  }

  // Stretch scenes to fit narration: remap every top-level tween's start through a
  // piecewise-linear old->new mark table. Long tweens (ambient drift, chapter bars)
  // are stretched too; short ones keep their snappy durations.
  function retime(tl, oldM, newM) {
    const map = (t) => {
      for (let i = 0; i < oldM.length - 1; i++) {
        if (t <= oldM[i + 1] || i === oldM.length - 2) {
          const k = (t - oldM[i]) / (oldM[i + 1] - oldM[i]);
          return newM[i] + k * (newM[i + 1] - newM[i]);
        }
      }
      return t;
    };
    tl.getChildren(false, true, true).forEach((c) => {
      const s = c.startTime(), d = c.totalDuration();
      const ns = Math.max(0, map(s));
      if (d > 2.5) c.timeScale(d / Math.max(0.01, map(s + d) - ns));
      c.startTime(ns);
    });
  }

  function boot(tl) {
    tl.pause(0);
    window.__tl = tl;
    window.__duration = tl.duration();
    window.__seek = (t) => { tl.time(t, false); return true; };
    fit();
    if (RENDER) { window.__ready = document.fonts.ready.then(() => true); return; }
    // Preview controls
    const ctl = document.createElement("div");
    ctl.id = "ctl";
    ctl.innerHTML = `<button id="pp">Pause</button><input id="sc" type="range" min="0" max="${tl.duration()}" step="0.01" value="0"><span id="tc">0.00</span>`;
    document.body.appendChild(ctl);
    const sc = $("#sc"), tc = $("#tc"), pp = $("#pp");
    const t0 = parseFloat(new URLSearchParams(location.search).get("t") || "0");
    let playing = !new URLSearchParams(location.search).has("still");
    let last = performance.now(), cur = t0;
    tl.time(cur, false);
    pp.textContent = playing ? "Pause" : "Play";
    pp.onclick = () => { playing = !playing; pp.textContent = playing ? "Pause" : "Play"; last = performance.now(); };
    sc.oninput = () => { cur = +sc.value; tl.time(cur, false); };
    window.__goto = (t) => { playing = false; pp.textContent = "Play"; cur = t; tl.time(cur, false); };
    document.fonts.ready.then(() => {
      const loop = (now) => {
        if (playing) { cur += (now - last) / 1000; if (cur > tl.duration()) cur = 0; tl.time(cur, false); }
        last = now; sc.value = cur; tc.textContent = cur.toFixed(2);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
  }

  window.M = { $, $$, splitWords, capIn, capOut, type, count, chapters, retime, boot, RENDER };
})();
