"""Procedural underscore synced to the scene marks in a video config. No licensed audio.

    python music.py <video.json>      -> audio/<id>/music.wav

Each scene's "music" field picks a section: intro | tense | lift | groove | full | end
(see LEVELS). The first "lift" gets a riser + impact (the "here's the fix" moment); "end"
stops the groove and rings out on the tonic chord. Uses scenes[i].start (after fit.py),
falling back to the design marks. Optional cfg.music: {"bpm": 96, "seed": 11}.
"""
import json, sys, wave, pathlib
import numpy as np

SR = 48000
CFG_PATH = pathlib.Path(sys.argv[1]).resolve()
CFG = json.loads(CFG_PATH.read_text(encoding="utf-8"))
MUS = CFG.get("music", {})
BPM = MUS.get("bpm", 96)
BEAT = 60 / BPM
BAR = BEAT * 4
rng = np.random.default_rng(MUS.get("seed", 11))

LEVELS = {  # pad, arp, tick, kick(0 none,1 half,2 four), bass, hats
    "intro": (1.0, 0.0, 0.0, 0, 0.0, 0.0),
    "tense": (0.9, 0.55, 0.5, 0, 0.0, 0.0),
    "lift": (1.0, 0.8, 0.0, 1, 0.8, 0.0),
    "groove": (1.0, 0.9, 0.0, 1, 0.9, 0.35),
    "full": (1.0, 1.0, 0.0, 2, 1.0, 0.6),
    "end": (1.0, 0.0, 0.0, 0, 0.0, 0.0),
}

CHORDS = [  # (bass midi, pad voicing)
    (38, [50, 57, 61, 64, 66]),   # Dmaj9
    (35, [47, 54, 57, 61, 62]),   # Bm9
    (31, [43, 50, 54, 57, 59]),   # Gmaj9 (G6/9 flavour)
    (33, [45, 52, 57, 59, 64]),   # A add9 sus
]
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)


def env_adsr(n, a, r):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na: e[:na] = np.linspace(0, 1, na) ** 2
    if nr: e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e


def add(buf, start, sig):
    i = int(start * SR)
    if i >= buf.shape[1]: return
    j = min(buf.shape[1], i + sig.shape[-1])
    buf[:, i:j] += sig[..., : j - i]


def pan(sig, p):  # p -1..1
    l, r = np.cos((p + 1) * np.pi / 4), np.sin((p + 1) * np.pi / 4)
    return np.vstack([sig * l, sig * r])


def pad_note(m, dur, bright):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    for det, p in ((-7, -0.6), (7, 0.6), (0, 0)):
        f = hz(m) * 2 ** (det / 1200)
        s = np.zeros(n)
        for k in range(1, 9):
            if f * k > 9000: break
            lfo = 1 + 0.25 * np.sin(2 * np.pi * 0.11 * t + k)
            s += np.sin(2 * np.pi * f * k * t + rng.uniform(0, 6.28)) * (bright ** (k - 1)) / k ** 1.2 * lfo
        out += pan(s, p)
    return out * env_adsr(n, 1.4, 1.6) / 3


def pluck(m, dur=1.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(m)
    s = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.08)
         + 0.12 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t / 0.05))
    return s * np.exp(-t / 0.28) * np.minimum(1, t / 0.004)


def kick():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 46 + 90 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.16) * np.minimum(1, t / 0.002)


def bandnoise(n, lo, hi):
    x = rng.standard_normal(n)
    X = np.fft.rfft(x)
    fr = np.fft.rfftfreq(n, 1 / SR)
    X[(fr < lo) | (fr > hi)] = 0
    y = np.fft.irfft(X, n)
    return y / (np.abs(y).max() + 1e-9)


HAT = bandnoise(int(0.06 * SR), 7000, 15000) * np.exp(-np.arange(int(0.06 * SR)) / SR / 0.012)
TICK = bandnoise(int(0.03 * SR), 2500, 6000) * np.exp(-np.arange(int(0.03 * SR)) / SR / 0.006)


def riser(dur):
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    lo = bandnoise(n, 300, 2500) * 0.6 + bandnoise(n, 2500, 9000) * t ** 2
    return lo * t ** 2.2


def impact():
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * (38 + 30 * np.exp(-t / 0.08)) * t) * np.exp(-t / 0.7)
    air = bandnoise(n, 200, 4000) * np.exp(-t / 0.35) * 0.25
    return boom + air


def swoosh(dur=0.9):
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    return bandnoise(n, 800, 6000) * np.sin(np.pi * t) ** 2


def reverb(x, secs=2.8, mix=0.32):
    n = int(secs * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t / (secs / 5.5))
        ir[: int(0.012 * SR)] = 0
        ir /= np.sqrt((ir ** 2).sum())
        L = x.shape[1] + n
        N = 1 << (L - 1).bit_length()
        y = np.fft.irfft(np.fft.rfft(x[ch], N) * np.fft.rfft(ir, N), N)[: x.shape[1]]
        out[ch] = y
    return x * (1 - mix) + out * mix * 1.6


def main():
    sc = CFG["scenes"]
    marks = [s.get("start", s["mark"]) for s in sc]
    secs = [s.get("music", "groove") for s in sc]
    total = CFG.get("total", CFG["design_total"])
    N = int((total + 0.5) * SR)
    sect = lambda t: secs[max(i for i, m in enumerate(marks) if m <= t + 1e-6)]
    end_t = next((m for m, x in zip(marks, secs) if x == "end"), total - 0.01)

    pad = np.zeros((2, N)); arp = np.zeros((2, N)); drm = np.zeros((2, N)); bas = np.zeros((2, N)); fx = np.zeros((2, N))

    # chords every 2 bars until the end mark, then a held Dmaj9 to the finish
    t, ci = 0.0, 0
    while t < end_t:
        seg = min(2 * BAR, end_t - t)
        lvl = LEVELS[sect(t)][0]
        bright = 0.42 if sect(t) == "intro" else 0.5
        for m in CHORDS[ci % 4][1]:
            add(pad, t, pad_note(m, seg + 1.6, bright) * lvl * 0.16)
        t += seg; ci += 1
    for m in CHORDS[0][1] + [69, 73]:
        add(pad, end_t, pad_note(m, total - end_t + 0.5, 0.48) * 0.17)

    # eighth-note arpeggio, ticks, drums, bass on the beat grid
    pattern = [0, 2, 3, 4, 2, 3, 1, 3]
    step = BEAT / 2
    k = 0
    while k * step < end_t:
        t = k * step
        s = sect(t)
        pl, al, tl_, kl, bl, hl = LEVELS[s]
        ch = CHORDS[int(t // (2 * BAR)) % 4]
        if al:
            m = sorted(ch[1])[pattern[k % 8]] + 12
            p = pluck(m) * al * (0.11 if k % 2 == 0 else 0.08)
            add(arp, t, pan(p, -0.35 if k % 2 else 0.35))
            add(arp, t + 3 * step, pan(p * 0.32, 0.35 if k % 2 else -0.35))  # ping-pong echo
        if tl_:
            add(drm, t, pan(TICK * tl_ * (0.05 if k % 2 == 0 else 0.03), 0.2))
        beat = k % 2 == 0
        bi = (k // 2) % 4
        if kl and beat and (kl == 2 or bi in (0, 2)):
            add(drm, t, pan(kick() * 0.42, 0))
        if bl:
            n = int(step * SR)
            tt = np.arange(n) / SR
            f = hz(ch[0] + 12)
            b = (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(4 * np.pi * f * tt)) * np.minimum(1, tt / 0.03) * np.exp(-tt / 0.5)
            duck = 0.55 if beat else 1.0
            add(bas, t, pan(b * bl * 0.16 * duck, 0))
        if hl and not beat:
            add(drm, t, pan(HAT * hl * 0.05, 0.3))
        if hl and k % 1 == 0:
            add(drm, t + step / 2, pan(HAT * hl * 0.018, -0.3))
        k += 1

    # transitions: swoosh into every scene, riser + impact into the first "lift"
    lifted = False
    for i, m in enumerate(marks[1:], 1):
        if secs[i] == "lift" and not lifted:
            lifted = True
            add(fx, m - 2.4, pan(riser(2.4) * 0.11, 0))
            add(fx, m, pan(impact() * 0.32, 0))
        elif secs[i] == "end":
            add(fx, m - 1.6, pan(riser(1.6) * 0.07, 0))
            add(fx, m, pan(impact() * 0.22, 0))
        else:
            add(fx, m - 0.55, pan(swoosh() * 0.05, 0.4 if i % 2 else -0.4))

    wet = reverb(pad + arp * 0.9 + fx * 0.6)
    mix = wet + drm + bas + fx * 0.4
    # fade in / out
    fi = int(1.2 * SR); mix[:, :fi] *= np.linspace(0, 1, fi)
    fo = int(3.5 * SR); mix[:, -fo:] *= np.linspace(1, 0, fo) ** 2
    mix = np.tanh(mix * 1.2) / np.tanh(1.2)
    mix /= np.abs(mix).max() / 0.89
    pcm = (mix.T * 32767).astype("<i2")
    out = CFG_PATH.parent / "audio" / CFG["id"] / "music.wav"
    out.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print(f"{out} {N / SR:.1f}s")


if __name__ == "__main__":
    main()
