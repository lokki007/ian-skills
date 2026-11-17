"""Generate narration for every scene in a video config, trim silence, record durations.

    python tts.py <video.json> [scene_key ...]     # keys = only regenerate those scenes

Needs OPENAI_API_KEY. Writes audio/<id>/raw/*.wav and audio/<id>/vo/*.wav (trimmed, 48k mono),
and stores each clip's length as scenes[i].vo_dur in the config.
"""
import json, subprocess, sys, pathlib
from openai import OpenAI

DEFAULT_INSTR = ("Voice of a calm, confident product explainer for a company leadership meeting. "
                 "Warm, clear American English, unhurried pace with natural pauses at commas and periods. "
                 "Lightly upbeat and assured, never salesy or theatrical.")
TRIM = ("silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
        "silenceremove=start_periods=1:start_threshold=-45dB,areverse")

cfg_path = pathlib.Path(sys.argv[1]).resolve()
only = set(sys.argv[2:])
cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
root = cfg_path.parent / "audio" / cfg["id"]
(root / "raw").mkdir(parents=True, exist_ok=True)
(root / "vo").mkdir(parents=True, exist_ok=True)
client = OpenAI()
instr = cfg.get("voice_instructions", DEFAULT_INSTR)


def dur(f):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)],
                                capture_output=True, text=True).stdout.strip())


for i, s in enumerate(cfg["scenes"]):
    name = f"{i:02d}-{s['key']}.wav"
    raw, vo = root / "raw" / name, root / "vo" / name
    if not s.get("vo"):
        s["vo_dur"] = 0
        continue
    if not vo.exists() or not only or s["key"] in only:
        with client.audio.speech.with_streaming_response.create(
            model=cfg.get("tts_model", "gpt-4o-mini-tts"), voice=cfg.get("voice", "cedar"),
            input=s["vo"], instructions=instr, response_format="wav",
        ) as r:
            r.stream_to_file(raw)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af", TRIM, "-ar", "48000", "-ac", "1", str(vo)], check=True)
    s["vo_dur"] = round(dur(vo), 3)
    print(f"{name}\t{s['vo_dur']:.2f}s\t{s['vo'][:70]}")

cfg_path.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
