"""Stretch scenes so each narration line fits, then patch the HTML's `// @retime` line.

    python fit.py <video.json>

A scene keeps its design length unless its narration needs more:
    new_len = max(design_len, vo_dur + vo_lead + vo_tail)
Writes scenes[i].start and total into the config. common.js remaps every tween through the
old->new marks, so animations spread out while their own durations stay snappy.
"""
import json, re, sys, pathlib

cfg_path = pathlib.Path(sys.argv[1]).resolve()
cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
lead, tail = cfg.get("vo_lead", 0.4), cfg.get("vo_tail", 0.9)
sc = cfg["scenes"]
old = [s["mark"] for s in sc] + [cfg["design_total"]]
new, cur = [], 0.0
for i, s in enumerate(sc):
    design = old[i + 1] - old[i]
    need = s.get("vo_dur", 0) + lead + tail if s.get("vo") else 0
    length = round(max(design, need), 2)
    s["start"] = round(cur, 2)
    new.append(round(cur, 2))
    flag = "  <- stretched" if length > design + 0.01 else ""
    print(f"{s['key']:<12} design {design:5.1f}s  vo {s.get('vo_dur', 0):5.2f}s  -> {length:5.1f}s{flag}")
    cur += length
new.append(round(cur, 2))
cfg["total"] = round(cur, 2)
cfg_path.write_text(json.dumps(cfg, indent=2), encoding="utf-8")

html = cfg_path.parent / cfg["html"]
s = html.read_text(encoding="utf-8")
line = f"const RETIME = {{ old: {json.dumps(old)}, new: {json.dumps(new)} }}; // @retime"
s2, n = re.subn(r"^.*// @retime.*$", line, s, count=1, flags=re.M)
if not n:
    sys.exit(f"no '// @retime' line in {html} — add: const RETIME = null; // @retime  and  if (RETIME) M.retime(tl, RETIME.old, RETIME.new);")
html.write_text(s2, encoding="utf-8")
print(f"total {cfg['total']}s (design {cfg['design_total']}s) · patched {html.name}")
