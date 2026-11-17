#!/usr/bin/env python3
"""
diff_rows.py — show the keep/revert decision for the last two rows.

Companion to templates/harness.py. Reads results.tsv and prints a single
line verdict + per-metric delta.

Usage:
    python scripts/diff_rows.py --tsv runs/<name>/results.tsv --last-two
"""
from __future__ import annotations
import argparse
import csv
import sys

NUMERIC = ["primary_score", "max_score", "blocking_failures", "worst_case_delta",
           "duration_s", "calls", "tokens", "cost_usd"]


def load(path: str) -> list[dict]:
    with open(path, newline="") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--tsv", required=True)
    p.add_argument("--last-two", action="store_true")
    args = p.parse_args()

    rows = load(args.tsv)
    if len(rows) < 2:
        print(f"need >=2 rows, have {len(rows)}")
        return 1

    a, b = rows[-2], rows[-1]
    print(f"row {a['experiment']} (artifact {a['artifact_hash']}) vs row {b['experiment']} (artifact {b['artifact_hash']})")
    print()

    deltas = []
    for col in NUMERIC:
        try:
            va, vb = float(a[col]), float(b[col])
            d = vb - va
            sign = "+" if d >= 0 else ""
            deltas.append((col, va, vb, d, sign))
        except (ValueError, KeyError):
            pass

    for col, va, vb, d, sign in deltas:
        arrow = "up" if d > 0 else ("down" if d < 0 else "=")
        print(f"  {col:>20s}  {va:>10}  ->  {vb:>10}   {sign}{d}  {arrow}")

    print()
    bf_delta = float(b["blocking_failures"]) - float(a["blocking_failures"])
    primary_delta = float(b["primary_score"]) - float(a["primary_score"])

    if bf_delta > 0:
        verdict = "DISCARD (blocking regression)"
    elif primary_delta > 0:
        verdict = "KEEP (primary improved, no blocking regression)"
    elif primary_delta == 0 and float(b["duration_s"]) < float(a["duration_s"]):
        verdict = "KEEP (equal primary, simpler/faster)"
    else:
        verdict = "DISCARD (no measured gain)"

    print(f"verdict: {verdict}")
    return 0


if __name__ == "__main__":
    sys.exit(main())