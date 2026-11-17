"""Quality checks you can run without eyes or ears.

    python qa.py sheet <out.jpg> <still1.png> <still2.png> ...   # contact sheet (3 per row) to review in one Read
    python qa.py vo <video.json>                                  # transcribe each clip, flag word mismatches
    python qa.py audio <video.mp4>                                # loudness, true peak, durations, waveform png
"""
import json, re, subprocess, sys, pathlib


def run(a):
    return subprocess.run(a, capture_output=True, text=True)


def sheet(out, files):
    cols = 3
    ins, labels = [], []
    for i, f in enumerate(files):
        ins += ["-i", f]
        labels.append(f"[{i}]scale=640:-1[s{i}]")
    while len(files) % cols:  # pad with black tiles
        files.append(None)
        i = len(files) - 1
        labels.append(f"color=black:s=640x360:d=1[s{i}]")
    layout = "|".join(f"{(i % cols) * 640}_{(i // cols) * 360}" for i in range(len(files)))
    g = ";".join(labels) + ";" + "".join(f"[s{i}]" for i in range(len(files))) + f"xstack=inputs={len(files)}:layout={layout}"
    r = run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", g, "-frames:v", "1", out])
    print(r.stderr or f"wrote {out}")


def vo(cfg_path):
    from openai import OpenAI
    c = OpenAI()
    cfg_path = pathlib.Path(cfg_path).resolve()
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    norm = lambda t: re.sub(r"[^a-z0-9 ]", " ", t.lower()).split()
    for i, s in enumerate(cfg["scenes"]):
        f = cfg_path.parent / "audio" / cfg["id"] / "vo" / f"{i:02d}-{s['key']}.wav"
        if not s.get("vo") or not f.exists():
            continue
        heard = c.audio.transcriptions.create(model="gpt-4o-mini-transcribe", file=open(f, "rb")).text
        a, b = norm(s["vo"]), norm(heard)
        miss = [w for w in a if w not in b]
        print(f"{'OK ' if not miss else '?? '}{s['key']}: {heard}" + (f"   [missing/changed: {' '.join(miss)}]" if miss else ""))


def audio(mp4):
    st = run(["ffmpeg", "-hide_banner", "-i", mp4, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr
    print("integrated", re.findall(r"I:\s+(-?[\d.]+) LUFS", st)[-1], "LUFS · true peak", re.findall(r"Peak:\s+(-?[\d.]+) dBFS", st)[-1], "dBFS")
    print(run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,duration", "-of", "compact", mp4]).stdout.strip())
    png = str(pathlib.Path(mp4).with_suffix(".wave.png"))
    run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-filter_complex", "showwavespic=s=1600x200:colors=0xcfaf40", "-frames:v", "1", png])
    print("waveform:", png)


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "sheet": sheet(sys.argv[2], sys.argv[3:])
    elif cmd == "vo": vo(sys.argv[2])
    elif cmd == "audio": audio(sys.argv[2])
    else: sys.exit(__doc__)
