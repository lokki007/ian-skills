"""Scaffold an explainer-video project.

    python new_project.py <project_dir> <video_id> [<video_id> ...] [--title "Name"] [--brand "Brand"]

Creates <project_dir>/src (shared CSS/JS, GSAP vendor files, one starter HTML per video)
and one <video_id>.json config per video. Never overwrites existing files.
"""
import argparse, json, pathlib, shutil

SKILL = pathlib.Path(__file__).resolve().parent.parent
TEMPLATE = SKILL / "assets" / "template" / "src"

ap = argparse.ArgumentParser()
ap.add_argument("project_dir")
ap.add_argument("ids", nargs="+")
ap.add_argument("--title", default="Explainer")
ap.add_argument("--brand", default="Brand")
a = ap.parse_args()

root = pathlib.Path(a.project_dir).resolve()
src = root / "src"
(src / "vendor").mkdir(parents=True, exist_ok=True)
for f in ["common.css", "common.js", "vendor/gsap.min.js", "vendor/MotionPathPlugin.min.js"]:
    dst = src / f
    if not dst.exists():
        shutil.copy2(TEMPLATE / f, dst)

starter = (TEMPLATE / "starter.html").read_text(encoding="utf-8")
for i, vid in enumerate(a.ids, 1):
    html = src / f"{vid}.html"
    if not html.exists():
        html.write_text(starter.replace("__TITLE__", a.title).replace("__BRAND__", a.brand), encoding="utf-8")
    cfg = root / f"{vid}.json"
    if not cfg.exists():
        cfg.write_text(json.dumps({
            "id": vid,
            "html": f"src/{vid}.html",
            "out": f"{i:02d}-{vid}.mp4",
            "voice": "cedar",
            "design_total": 27,
            "music": {"bpm": 96, "seed": 11},
            "scenes": [
                {"key": "intro", "mark": 0, "music": "intro", "vo": "A big, plain statement. And the twist."},
                {"key": "problem", "mark": 5, "music": "tense", "vo": "Here is the messy reality, and what it costs us every year."},
                {"key": "solve", "mark": 13, "music": "lift", "vo": "The AI reads it, fills in the fields, and a person only confirms."},
                {"key": "end", "mark": 21, "music": "end", "vo": "The payoff line, said plainly."},
            ],
        }, indent=2), encoding="utf-8")
print(f"scaffolded {root}")
for vid in a.ids:
    print(f"  src/{vid}.html  +  {vid}.json")
