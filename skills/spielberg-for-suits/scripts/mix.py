"""Place narration on the scene starts, duck the music under it, master, and mux onto the picture.

    python mix.py <video.json> [--silent build/<id>-silent.mp4]

Inputs: audio/<id>/vo/*.wav (tts.py), audio/<id>/music.wav (music.py), the silent render.
Output: cfg["out"] — H.264 copied, AAC 256k, -16 LUFS integrated, -1.5 dBTP limit.
"""
import json, re, subprocess, sys, pathlib

cfg_path = pathlib.Path(sys.argv[1]).resolve()
cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
root = cfg_path.parent
aud = root / "audio" / cfg["id"]
lead = cfg.get("vo_lead", 0.4)
total = cfg.get("total", cfg["design_total"])
silent = root / (sys.argv[sys.argv.index("--silent") + 1] if "--silent" in sys.argv else f"build/{cfg['id']}-silent.mp4")


def run(args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr[-2000:])
    return r.stderr


# 1) narration track: every clip delayed to its scene start + lead, padded to full length
ins, chains, n = [], [], 0
for i, s in enumerate(cfg["scenes"]):
    f = aud / "vo" / f"{i:02d}-{s['key']}.wav"
    if not s.get("vo") or not f.exists():
        continue
    ms = int((s.get("start", s["mark"]) + lead) * 1000)
    ins += ["-i", str(f)]
    chains.append(f"[{n}]adelay={ms}|{ms},aformat=channel_layouts=mono[a{n}]")
    n += 1
assert n, "no narration clips found — run tts.py first"
graph = ";".join(chains) + ";" + "".join(f"[a{i}]" for i in range(n)) + (
    f"amix=inputs={n}:normalize=0,highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120,"
    f"pan=stereo|c0=c0|c1=c0,apad=whole_dur={total + 2}[vo]")
vo = aud / "vo-track.wav"
run(["ffmpeg", "-y", "-v", "error", *ins, "-filter_complex", graph, "-map", "[vo]", "-ar", "48000", str(vo)])

# 2) music EQ'd out of the voice's way, ducked by the narration, summed
pre = aud / "premix.wav"
g = ("[0]highpass=f=35,equalizer=f=280:width_type=o:width=1.4:g=-3,equalizer=f=3000:width_type=o:width=1.5:g=-2,"
     f"volume={cfg.get('music_db', -9)}dB[m];"
     "[1]asplit=2[v1][sc];"
     "[m][sc]sidechaincompress=threshold=0.02:ratio=5:attack=60:release=650:makeup=1[md];"
     "[md][v1]amix=inputs=2:normalize=0:duration=first[out]")
run(["ffmpeg", "-y", "-v", "error", "-i", str(aud / "music.wav"), "-i", str(vo), "-filter_complex", g, "-map", "[out]", str(pre)])

# 3) linear gain to -16 LUFS + true-peak limiter
lufs = lambda f: run(["ffmpeg", "-hide_banner", "-i", str(f), "-af", "ebur128=peak=true", "-f", "null", "-"])
I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", lufs(pre))[-1])
final = aud / "final.wav"
run(["ffmpeg", "-y", "-v", "error", "-i", str(pre), "-af",
     f"volume={-16 - I:.2f}dB,alimiter=limit=0.84:attack=3:release=60:level=disabled", str(final)])
st = lufs(final)
print(f"{cfg['id']}: {re.findall(r'I:\s+(-?[\d.]+) LUFS', st)[-1]} LUFS, true peak {re.findall(r'Peak:\s+(-?[\d.]+) dBFS', st)[-1]} dBFS")

# 4) mux
if not silent.exists():
    sys.exit(f"silent render missing: {silent} (render.mjs --out it first); audio is at {final}")
out = root / cfg["out"]
run(["ffmpeg", "-y", "-v", "error", "-i", str(silent), "-i", str(final), "-map", "0:v", "-map", "1:a", "-c:v", "copy",
     "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", str(out)])
print("wrote", out)
