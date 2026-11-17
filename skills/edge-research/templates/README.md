# Templates & Scripts

These are the runnable artifacts that turn the edge-research loop from prose into a working pipeline. Each run lives in `runs/<name>/` and copies the templates it needs. Everything here needs only Python 3.8+ and the standard library.

## What's here

| Path | Purpose |
|---|---|
| `templates/preflight.md` | 10-item preflight template as headers. Fill in before row 0 is written. |
| `templates/post-run.md` | Three sections only: what improved / what didn't / real-world still unverified. |
| `templates/Makefile` | Optional `make baseline / mutate / eval / diff / ledger` wrapper around the four core commands. |
| `templates/harness.py` | Minimal frozen-schema row writer. No LLM in the scoring loop. |
| `templates/run.py` | Optional clean-environment launcher for a harness (clears leaked `PYTHONPATH` etc.). |
| `scripts/diff_rows.py` | Companion to `harness.py`. Prints a single-line verdict from the last two rows. |
| `examples/router-self-eval/` | Worked example: a stricter harness with a preflight gate, structural gates and a live-artifact pin, plus the 5-scenario × 8-check rubric it scores against. |

## Usage

From the project root (where `runs/` lives), with `SKILL` set to this skill's folder:

```bash
mkdir -p runs/my-run/baseline runs/my-run/candidate runs/my-run/outputs
cp "$SKILL/templates/preflight.md" runs/my-run/preflight.md
# fill in preflight
cp "$SKILL/templates/Makefile" "$SKILL/templates/harness.py" "$SKILL/scripts/diff_rows.py" runs/my-run/

make -f runs/my-run/Makefile NAME=my-run baseline
# edit one bounded surface in runs/my-run/candidate/
make -f runs/my-run/Makefile NAME=my-run eval
make -f runs/my-run/Makefile NAME=my-run diff
```

Without `make`, call the scripts directly:

```bash
python runs/my-run/harness.py --artifact runs/my-run/baseline --kind current-real --output runs/my-run/results.tsv --row 0
python runs/my-run/harness.py --artifact runs/my-run/candidate --kind mutation --output runs/my-run/results.tsv --primary-score 7 --max-score 10
python runs/my-run/diff_rows.py --tsv runs/my-run/results.tsv --last-two
```

The Makefile is an optional example. Use the existing task runner when available; completion requires reproducible evaluation and an evidence-backed decision, not a particular command name.

## Why these exist

The router SKILL.md tells the agent what to think. These files turn that thinking into four commands and a ledger row that a future agent (or a reviewer) can read without re-deriving the loop.
