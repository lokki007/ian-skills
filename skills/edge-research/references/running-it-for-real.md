# Running EdgeResearch For Real

The router SKILL.md tells you *what* the protocol is. This file tells
you *how to actually execute one full run* end-to-end, with the
environment quirks, gate design, and adversarial testing pattern that
the protocol assumes but does not spell out.

This recipe comes from a real run. Reuse it; do not reinvent.

## Pre-run checklist (must all be true before mutating)

- [ ] `runs/<name>/` directory exists with `baseline/`, `generations/`, `outputs/`, `evals/`, `holdouts/`, `branches/`, `final/`.
- [ ] `evals/scenarios.md` is frozen and hashed. Scenarios ≥5; checks per scenario ≥6.
- [ ] `runs/<name>/preflight.md` exists with `classified_as:`, `specialist_loaded:`, and `harness_hash:` filled in (the harness refuses to run without these — see "Preflight gate" below).
- [ ] The harness script exists at the run root and takes the artifact path + preflight path as args.

If any of these is missing, stop and create it. The protocol says:
"freeze the evaluation before baseline." That means literally on disk
and hashable, not "I have a plan in my head."

## Preflight gate (the structural enforcement pattern)

The router's "Mandatory Routing Decision Record" is prose. To make
it real, encode it in the harness:

```python
ALLOWED_CLASSIFICATIONS = {
    "strategy", "code", "system", "performance", "harvest",
    "edge-research-strategy", "edge-research-code", "edge-research-system",
    "edge-research-performance", "edge-research-harvest",
}

def preflight_gate(preflight_path, expected_harness_hash):
    failures = []
    fields = {"classified_as": "", "specialist_loaded": "", "harness_hash": ""}
    if not preflight_path.exists():
        failures.append("preflight_missing")
        return False, fields, failures, ""
    text = preflight_path.read_text(encoding="utf-8", errors="replace")

    def extract(field):
        # Line-by-line match. Do NOT use a single regex with \s*$ — it
        # greedily eats the trailing newline and the next line's content
        # leaks into the value. See "Regex greediness gotcha" below.
        for raw in text.splitlines():
            m = re.match(rf"(?i)^{field}\s*[:=]\s*(.*)$", raw.strip())
            if m:
                v = m.group(1).strip()
                return v if v else ""
        return ""

    fields["classified_as"] = extract("classified_as")
    fields["specialist_loaded"] = extract("specialist_loaded")
    fields["harness_hash"] = extract("harness_hash")

    if fields["classified_as"] not in ALLOWED_CLASSIFICATIONS:
        failures.append(f"classified_as_invalid:{fields['classified_as']!r}")
    if not fields["specialist_loaded"]:
        failures.append("specialist_loaded_missing")
    elif fields["specialist_loaded"] not in {
        "edge-research-strategy", "edge-research-code", "edge-research-system",
        "edge-research-performance", "edge-research-harvest",
    }:
        failures.append(f"specialist_loaded_invalid:{fields['specialist_loaded']!r}")
    expected_short = expected_harness_hash[:16]
    if fields["harness_hash"] != expected_short:
        failures.append(f"harness_hash_mismatch:{fields['harness_hash']!r}!={expected_short!r}")

    return len(failures) == 0, fields, failures, sha256_file(preflight_path)
```

The harness calls this gate before writing any `results.tsv` row.
If the gate fails, exit 2 and write nothing. The ledger only ever
contains rows the agent earned by writing a valid preflight.

The `harness_hash` check is short-prefix (16 hex chars) so the
preflight doesn't have to pin the full hash; just enough to detect
harness drift between freeze and run.

## Adversarial testing (the rubric cannot catch what these catch)

Every run must include at least three adversarial preflight fixtures.
The first iteration of `extract(field)` passed the rubric at 40/40
but had a real bug — adversarial testing caught it.

Minimum adversarial preflights to write per run:

1. **Missing preflight** — `--preflight DOES-NOT-EXIST.md`. Expect `preflight_missing`, exit 2, no row.
2. **Empty `classified_as:`** — file exists but value is empty. Expect `classified_as_invalid:''`, exit 2, no row.
3. **Wrong `harness_hash:`** — value is a valid string but does not match the live harness. Expect `harness_hash_mismatch`, exit 2, no row.

Optional but valuable:

4. **Wrong `specialist_loaded:`** — value is in the wrong specialist for the classified_as.
5. **Classification lies about the artifact** — preflight says `harvest` for an obvious code-domain task; a future-generation judge should catch this.

A single-judge self-rubric at 40/40 is a saturation signal, not
proof of correctness. Adversarial test results are deterministic
evidence. Always include them.

## Regex greediness gotcha (the bug the protocol assumed away)

The natural way to write `extract(field)` is:

```python
re.search(rf"(?im)^\s*{field}\s*[:=]\s*(.+?)\s*$", text)
```

This silently fails on `classified_as:` (empty value) because `\s*$`
greedily eats the trailing newline, then `(.+?)` matches across the
line break and captures the *next line's content* as the value. The
harness then reports `classified_as: "specialist_loaded: edge-research-code"`
and the bug only shows up at runtime, not in any rubric.

Fix: line-by-line match with an explicit empty-value check, as shown
in the "Preflight gate" code above. Always test the empty-value case
before shipping any field-extraction logic.

## Run it

A working harness with this gate lives at
`examples/router-self-eval/harness.py` (rubric: `scenarios.md` beside it).
Copy it, `templates/run.py`, your own `evals/scenarios.md`, and a
`preflights/` directory as the starter kit for the next run. Adapt
`structural_rules()` to the artifact you are optimizing.

The four core commands are:

```
python run.py --candidate <artifact-path> --preflight <preflight.md> \
              --experiment <exp-NN> --description "<text>" \
              --baseline-kind current-real \
              --primary-score <0..max> --max-score <max> \
              --worst-case-delta <±N> \
              --per-case-scores "S1:N/8,..." \
              --status <keep|discard|crash|baseline|measure>
```

Each invocation writes one `results.tsv` row. Read the row to decide
keep / discard / crash. Never decide from prose alone.

## Anti-patterns this run caught

These are not the protocol's "common pitfalls" — these are the things
a real run *actually* hit. If the
next run does any of these, treat it as a finding, not a shortcut.

1. **Gate set, then silently loosened during the experiment.** A
   compactness gate started at 2,200 chars / 60 lines (unachievable
   while keeping the per-run artifact contract in the router body)
   and was loosened to 5,000 / 100. The looser gate is fine; the
   *silent* loosening is not. Document the adjustment in changelog.
2. **Rubric score at the ceiling is a saturation signal, not proof.**
   Three consecutive versions scored 25/25, 40/40 and 40/40 — all at
   the rubric's max. Trust the adversarial-test rows, not the score.
3. **Judge bias is real.** Same agent writing the mutation and scoring
   it is a single-judge setup. Adversarial testing reduces the impact
   but does not eliminate it. Plan an independent reviewer run before
   any external claim.
4. **Backup before destructive mutations.** Keep the prior artifact
   and the prior harness under `baseline/` (e.g.
   `baseline/SKILL.md.v3-backup`, `baseline/harness.py.gen1-backup`).
   Both are required to revert if a future experiment demands a new
   generation's baseline.