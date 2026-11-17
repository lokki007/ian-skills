#!/usr/bin/env python3
"""
harness.py — write one results.tsv row.

Frozen schema. No LLM in the scoring loop. If you need an LLM to score,
the score belongs in a sibling script that this one calls, and the script
is part of the frozen harness hash.

Usage:
    python harness.py --artifact <path> --kind <current-real|mutation> \
                      --output <path/to/results.tsv> --row <int|auto>
"""
from __future__ import annotations
import argparse
import csv
import datetime as dt
import hashlib
import os
import sys

COLUMNS = [
    "generation",
    "experiment",
    "baseline_kind",
    "harness_hash",
    "artifact_hash",
    "primary_score",
    "max_score",
    "blocking_failures",
    "worst_case_delta",
    "status",
    "duration_s",
    "calls",
    "tokens",
    "cost_usd",
    "description",
]


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()[:12]


def sha256_dir(path: str) -> str:
    h = hashlib.sha256()
    for root, _, files in os.walk(path):
        for f in sorted(files):
            h.update(f.encode())
            h.update(sha256_file(os.path.join(root, f)).encode())
    return h.hexdigest()[:12]


def next_row_n(tsv_path: str) -> int:
    if not os.path.exists(tsv_path):
        return 1
    with open(tsv_path, newline="") as f:
        rows = list(csv.DictReader(f, delimiter="\t"))
    return len(rows)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--artifact", required=True, help="path to artifact (file or dir)")
    p.add_argument("--kind", required=True, choices=["current-real", "mutation", "historical", "synthetic-negative-control"])
    p.add_argument("--output", required=True, help="path to results.tsv")
    p.add_argument("--row", default="auto", help="row number or 'auto'")
    p.add_argument("--primary-score", type=float, default=0.0)
    p.add_argument("--max-score", type=float, default=0.0)
    p.add_argument("--blocking-failures", type=int, default=0)
    p.add_argument("--worst-case-delta", type=float, default=0.0)
    p.add_argument("--status", default="pending", choices=["keep", "discard", "crash", "pending"])
    p.add_argument("--duration-s", type=float, default=0.0)
    p.add_argument("--calls", type=int, default=0)
    p.add_argument("--tokens", type=int, default=0)
    p.add_argument("--cost-usd", type=float, default=0.0)
    p.add_argument("--description", default="")
    p.add_argument("--harness-hash", default="", help="hash of the frozen harness; computed from this script if empty")
    args = p.parse_args()

    if os.path.isdir(args.artifact):
        artifact_hash = sha256_dir(args.artifact)
    else:
        artifact_hash = sha256_file(args.artifact)

    harness_hash = args.harness_hash or sha256_file(__file__)

    row_n = next_row_n(args.output) if args.row == "auto" else int(args.row)

    row = {
        "generation": 1,
        "experiment": row_n,
        "baseline_kind": args.kind,
        "harness_hash": harness_hash,
        "artifact_hash": artifact_hash,
        "primary_score": args.primary_score,
        "max_score": args.max_score,
        "blocking_failures": args.blocking_failures,
        "worst_case_delta": args.worst_case_delta,
        "status": args.status,
        "duration_s": args.duration_s,
        "calls": args.calls,
        "tokens": args.tokens,
        "cost_usd": args.cost_usd,
        "description": args.description,
    }

    exists = os.path.exists(args.output)
    with open(args.output, "a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, delimiter="\t")
        if not exists:
            w.writeheader()
        w.writerow(row)

    print(f"wrote row {row_n} -> {args.output}  artifact={artifact_hash}")
    return 0


if __name__ == "__main__":
    sys.exit(main())