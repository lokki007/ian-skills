#!/usr/bin/env python3
"""
harness.py — worked example: an EdgeResearch harness that scores the
edge-research router skill itself.

This is a fuller harness than `templates/harness.py`. It shows the
structural-enforcement patterns described in the references:

  1. **Preflight gate.** No `results.tsv` row is written unless
     `preflight.md` exists and names a valid `classified_as:`,
     `specialist_loaded:` and a `harness_hash:` matching the frozen
     scenarios file (first 16 hex chars). Fields are parsed line by line
     so an empty value never captures the next line.

  2. **Bundle self-containment.** `--scenarios-path` is configurable.
     Default probes `ROOT/evals/scenarios.md`, then `ROOT/scenarios.md`,
     so a judge can run the harness from inside a copied judge bundle.

  3. **Live-artifact pin.** If `--live-tree` (or the env var
     `EDGE_RESEARCH_LIVE_TREE`) points at the deployed skills directory,
     the harness refuses to score a candidate that lives under it unless
     `--allow-live-router` is also passed. This keeps judges and parallel
     workers from mutating the deployed router during a run. Copy the
     router to an isolated path (e.g. `branches/exp-NN/SKILL.md`) instead.

  4. **Structural gates anchored to markers.** Gates match markdown
     headings (`## ...`), not bare phrases, and fire on any candidate whose
     full path mentions `edge-research`, not only a leaf named `SKILL.md`.

Usage:
    python harness.py --candidate branches/exp-NN/SKILL.md \\
        --preflight runs/exp-NN/preflight.md \\
        --experiment exp-NN --description "..."

    # from inside a judge bundle with scenarios.md at the bundle root:
    python harness.py --candidate SKILL-router.md \\
        --preflight example-preflight.md \\
        --scenarios-path scenarios.md \\
        --experiment exp-NN-judge --description "..."

    # point --skills-root at the folder holding the edge-research-* skills
    # (default: two levels above this file's folder, i.e. the repo's skills/).
"""
import argparse
import csv
import datetime
import hashlib
import json
import os
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
DEFAULT_SKILLS_ROOT = ROOT.parents[2]  # skills/edge-research/examples/router-self-eval -> skills/

SCHEMA = [
    "generation", "experiment", "baseline_kind", "harness_hash",
    "artifact_hash", "primary_score", "max_score", "blocking_failures",
    "worst_case_delta", "per_case_scores", "status", "duration_s",
    "calls", "tokens", "cost_usd", "preflight_hash", "classified_as",
    "preflight_ok", "description",
]

ROUTER_MAX_CHARS = 10000
ROUTER_MAX_LINES = 100

SPECIALISTS = {
    "edge-research-strategy", "edge-research-code", "edge-research-system",
    "edge-research-performance", "edge-research-harvest",
}
# Allowed values for `classified_as:` — the router's routing outputs.
ALLOWED_CLASSIFICATIONS = {
    "strategy", "code", "system", "performance", "harvest",
} | SPECIALISTS


def sha256_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_dir(p):
    h = hashlib.sha256()
    n = 0
    for dp, _, fns in os.walk(p):
        for f in sorted(fns):
            full = os.path.join(dp, f)
            h.update(os.path.relpath(full, p).encode())
            with open(full, "rb") as fh:
                h.update(fh.read())
            n += 1
    return h.hexdigest(), n


def resolve_scenarios_path(explicit_path: str) -> pathlib.Path:
    """Resolution order:
      1. --scenarios-path if explicitly passed and exists (absolute, cwd- or ROOT-relative)
      2. ROOT/evals/scenarios.md (canonical location)
      3. ROOT/scenarios.md (judge-bundle layout)
    """
    if explicit_path:
        p = pathlib.Path(explicit_path).resolve()
        if p.exists():
            return p
        rel = (ROOT / explicit_path).resolve()
        if rel.exists():
            return rel
    candidates = [ROOT / "evals" / "scenarios.md", ROOT / "scenarios.md"]
    for c in candidates:
        if c.exists():
            return c
    raise FileNotFoundError(
        f"Could not locate scenarios.md. Tried: {[str(c) for c in candidates]} "
        f"and --scenarios-path={explicit_path!r}."
    )


def live_router_pin(candidate_path: pathlib.Path, live_tree, allow_live: bool) -> tuple:
    """Refuse to score a candidate inside the deployed skill tree unless the
    caller explicitly opts in. Returns (ok, reason)."""
    if not live_tree:
        return True, "no_live_tree_configured"
    live_tree = pathlib.Path(live_tree).resolve()
    try:
        candidate_path.relative_to(live_tree)
        in_live_tree = True
    except ValueError:
        in_live_tree = False
    if not in_live_tree:
        return True, "candidate_outside_live_skill_tree"
    if allow_live:
        return True, "live_router_override"
    return False, (
        f"candidate lives under the live skill tree ({live_tree}); refusing to run. "
        "Copy the router to an isolated path (e.g. branches/exp-NN/SKILL.md) "
        "and pass that as --candidate. Override with --allow-live-router "
        "only when you intend to score the deployed file."
    )


def structural_rules(candidate_path, candidate_text, skills_root: pathlib.Path):
    """Hard structural gates. Any failure here is a blocking failure."""
    rules = {}
    text = candidate_text or ""
    if candidate_path.is_file():
        rules["candidate_is_router_md"] = (
            "name: edge-research" in text and "## Routing Decision" in text
        )
    else:
        rules["candidate_loaded"] = candidate_path.exists()
    rules["has_router"] = (skills_root / "edge-research" / "SKILL.md").exists()
    rules["has_specialists"] = all(
        (skills_root / f"edge-research-{s}" / "SKILL.md").exists()
        for s in ["code", "strategy", "system", "performance"]
    )
    rules["has_harvest"] = (skills_root / "edge-research-harvest" / "SKILL.md").exists()
    # Router-text discipline gates. Fire whenever the full candidate path
    # mentions edge-research, regardless of leaf filename, so bundle names
    # like SKILL-router.md cannot bypass them.
    if candidate_path.is_file() and "edge-research" in str(candidate_path):
        rules["router_size_chars"] = len(text) <= ROUTER_MAX_CHARS
        rules["router_size_lines"] = text.count("\n") <= ROUTER_MAX_LINES
        rules["router_has_decision_record"] = "Routing Decision Record" in text
        # Match the H2 marker, not the bare phrase: a router that mentions the
        # phrase in prose without an actual section must fail.
        rules["adversarial_inline"] = "## Adversarial Sub-case Recognition" in text
    return rules


def preflight_gate(preflight_path: pathlib.Path, expected_harness_hash: str):
    """Returns (ok, fields, failures, preflight_hash).

    All four checks are required:
      1. file exists
      2. `classified_as:` has an allowed value
      3. `specialist_loaded:` names a real specialist
      4. `harness_hash:` matches the frozen scenarios hash (16-char prefix)
    """
    failures = []
    fields = {"classified_as": "", "specialist_loaded": "", "harness_hash": ""}
    if not preflight_path.exists():
        failures.append("preflight_missing")
        return False, fields, failures, ""
    preflight_hash = sha256_file(preflight_path)
    text = preflight_path.read_text(encoding="utf-8", errors="replace")

    def extract(field):
        # Line by line: a single multi-line regex with \s*$ would let an
        # empty value swallow the next line's content.
        for raw_line in text.splitlines():
            m = re.match(rf"(?i)^{field}\s*[:=]\s*(.*)$", raw_line.strip())
            if m:
                return m.group(1).strip()
        return ""

    fields = {
        "classified_as": extract("classified_as"),
        "specialist_loaded": extract("specialist_loaded"),
        "harness_hash": extract("harness_hash"),
    }

    if fields["classified_as"] not in ALLOWED_CLASSIFICATIONS:
        failures.append(f"classified_as_invalid:{fields['classified_as']!r}")
    if not fields["specialist_loaded"]:
        failures.append("specialist_loaded_missing")
    elif fields["specialist_loaded"] not in SPECIALISTS:
        failures.append(f"specialist_loaded_invalid:{fields['specialist_loaded']!r}")

    expected_short = expected_harness_hash[:16]
    if fields["harness_hash"] != expected_short:
        failures.append(
            f"harness_hash_mismatch:{fields['harness_hash']!r}!={expected_short!r}"
        )

    return len(failures) == 0, fields, failures, preflight_hash


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--candidate", required=True)
    ap.add_argument("--preflight", required=True, help="Path to runs/<name>/preflight.md.")
    ap.add_argument("--experiment", required=True)
    ap.add_argument("--description", required=True)
    ap.add_argument("--generation", default="1")
    ap.add_argument("--baseline-kind", default="current-real")
    ap.add_argument("--primary-score", type=float, default=0.0)
    ap.add_argument("--max-score", type=float, default=40.0)
    ap.add_argument("--worst-case-delta", type=float, default=0.0)
    ap.add_argument("--per-case-scores", default="")
    ap.add_argument("--status", default="discard")
    ap.add_argument("--output", default="results.tsv", help="Ledger path (default: ./results.tsv).")
    ap.add_argument("--scenarios-path", default="",
                    help="Path to scenarios.md. If empty, probes ROOT/evals/scenarios.md then ROOT/scenarios.md.")
    ap.add_argument("--skills-root", default=str(DEFAULT_SKILLS_ROOT),
                    help="Folder that contains the edge-research and edge-research-* skill folders.")
    ap.add_argument("--live-tree", default=os.environ.get("EDGE_RESEARCH_LIVE_TREE", ""),
                    help="Deployed skills folder to protect (or set EDGE_RESEARCH_LIVE_TREE).")
    ap.add_argument("--allow-live-router", action="store_true",
                    help="Allow scoring a candidate under --live-tree.")
    args = ap.parse_args()

    started = datetime.datetime.now(datetime.timezone.utc)
    cand = pathlib.Path(args.candidate).resolve()
    preflight_path = pathlib.Path(args.preflight).resolve()

    pin_ok, pin_reason = live_router_pin(cand, args.live_tree, args.allow_live_router)
    if not pin_ok:
        print(json.dumps({"crash": True, "reason": "live_router_pin_failed",
                          "detail": pin_reason, "row_written": False}, indent=2))
        sys.exit(2)

    candidate_text = ""
    if cand.is_file():
        try:
            candidate_text = cand.read_text(encoding="utf-8")
        except Exception:
            candidate_text = ""

    rules = structural_rules(cand, candidate_text, pathlib.Path(args.skills_root).resolve())
    blocking_structural = [k for k, v in rules.items() if not v]

    try:
        scenarios_p = resolve_scenarios_path(args.scenarios_path)
    except FileNotFoundError as e:
        print(json.dumps({"crash": True, "reason": "scenarios_not_found",
                          "detail": str(e), "row_written": False}, indent=2))
        sys.exit(2)
    harness_hash_full = sha256_file(scenarios_p)

    preflight_ok, preflight_fields, preflight_failures, preflight_hash = (
        preflight_gate(preflight_path, harness_hash_full)
    )

    if cand.is_dir():
        artifact_hash, _ = sha256_dir(cand)
    elif cand.exists():
        artifact_hash = sha256_file(cand)
    else:
        artifact_hash = ""

    ended = datetime.datetime.now(datetime.timezone.utc)

    # A failed preflight crashes the run: no row is written.
    if not preflight_ok:
        print(json.dumps({
            "crash": True,
            "reason": "preflight_gate_failed",
            "preflight_failures": preflight_failures,
            "preflight_fields": preflight_fields,
            "blocking_structural": blocking_structural,
            "row_written": False,
        }, indent=2))
        sys.exit(2)

    results_path = pathlib.Path(args.output).resolve()
    write_header = not results_path.exists()
    with open(results_path, "a", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=SCHEMA, delimiter="\t")
        if write_header:
            w.writeheader()
        w.writerow({
            "generation": args.generation,
            "experiment": args.experiment,
            "baseline_kind": args.baseline_kind,
            "harness_hash": harness_hash_full[:16],
            "artifact_hash": artifact_hash[:16],
            "primary_score": f"{args.primary_score:.2f}",
            "max_score": f"{args.max_score:.2f}",
            "blocking_failures": ",".join(blocking_structural) or "none",
            "worst_case_delta": f"{args.worst_case_delta:+.2f}",
            "per_case_scores": args.per_case_scores[:120],
            "status": args.status,
            "duration_s": f"{(ended - started).total_seconds():.2f}",
            "calls": "0",
            "tokens": "0",
            "cost_usd": "0.00",
            "preflight_hash": preflight_hash[:16],
            "classified_as": preflight_fields["classified_as"],
            "preflight_ok": "true",
            "description": args.description[:200],
        })

    print(json.dumps({
        "row_written": True,
        "results_path": str(results_path),
        "artifact_hash": artifact_hash[:16],
        "preflight_hash": preflight_hash[:16],
        "rules": rules,
        "blocking_failures": blocking_structural,
        "preflight_fields": preflight_fields,
        "router_chars": len(candidate_text) if candidate_text else None,
        "router_lines": candidate_text.count("\n") if candidate_text else None,
        "scenarios_path": str(scenarios_p),
        "live_router_pin": pin_reason,
    }, indent=2))


if __name__ == "__main__":
    main()
