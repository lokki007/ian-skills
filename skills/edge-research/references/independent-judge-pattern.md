# Independent Judge + Adversarial Harness Pattern

When a rubric saturates (the running session scores itself at the ceiling),
an independent judge with no prior context is the cheapest way to invert the
signal. This file documents the working pattern, the failure modes it caught,
and the pieces you need to reproduce it.

## When to use it

- Any rubric run that scores ≥95% on a 5–8 check scenario × scenario matrix.
- Any decision where the same agent that wrote the mutation is also scoring
  the rubric. Single-judge bias hides defects.
- Any time you want inter-rater reliability on subjective work (strategy,
  copy, prompts).

## The pattern (4 steps)

### 1. Bundle the artifacts, strip the priors

Create a folder that contains only what the judge should see:

```
judge-bundle/
├── JUDGE-BRIEF.md     # task instructions, no prior context allowed
├── SKILL-router.md    # the candidate router skill (copy, do not symlink)
├── harness.py         # the harness to score (copy)
├── scenarios.md       # the rubric scenarios (copy)
└── example-preflight.md  # illustrative, not scored
```

Do NOT include prior grading files, prior scoring, the changelog, the
running session's notes, or the ledger. The bundle is the entire judge
context.

### 2. Write a strict brief

The brief must explicitly forbid:
- Reading prior grading files.
- Looking up session history.
- Consulting prior rubrics.
- Assuming anything about who built the artifact.

It must specify the exact output shape (`verdict.md` with scenario scores
N/8 each, per-check notes, free-form notes, decision, why).

### 3. Dispatch a fresh sub-agent

Use your agent runtime's sub-agent or task-delegation facility (or a
separate session). The judge must get an isolated context, ideally a
different model, and only the bundle contents. Brief it to reply with
ONLY the contents of `verdict.md`.

### 4. Compare against the running session

Write a small script (e.g. `compare.py` in the run directory) that parses both
verdicts, computes per-scenario and aggregate divergence, and applies
a tolerance rule (default ±2 per scenario). Divergence > tolerance means
either the rubric is unstable or the running session missed something;
either way, both verdicts deserve a second look.

## What this pattern caught in practice

Three classes of defect that single-judge self-scoring misses:

1. **Adversarial reframe failures (C6).** Scenarios that test "does the
   agent recognize the question is malformed?" are scored 1 by the running
   session because the agent did its best. An independent judge reads
   the rubric cold and notices the rule was never enforced in the prose.
2. **Bundle self-containment defects.** Running the harness from inside
   the judge bundle crashed with `FileNotFoundError` because the
   harness reads `ROOT/evals/scenarios.md` but the bundle didn't ship
   `evals/`. The running session never caught this because it always
   ran the harness from the parent directory.
3. **Sub-agent live-file mutation.** When the judge runs `harness.py`,
   it may also edit the live `SKILL-router.md` as part of its scoring.
   The router can silently grow back over the compactness gate. Fix:
   re-hash the live file after every cross-agent step and re-apply
   the reform from a branches/ folder if the hash drifts.

## Adversarial harness tests (companion pattern)

For every preflight gate, ship 3–5 adversarial preflight fixtures that
*should crash*:

```
preflights/
├── exp-NN-preflight.md           # valid, should pass
├── adv1-missing-file.md          # missing preflight file
├── adv2-empty-classified.md      # classified_as: (empty)
├── adv3-wrong-hash.md            # harness_hash: 0000…0000
└── adv4-invalid-specialist.md    # specialist_loaded: not-a-real-one
```

Run each. They must exit 2 and write zero rows to results.tsv.
If any succeeds, that's a bypass — fix it before declaring the gate works.

**Bug class the adversarial tests catch that rubric scoring misses:**
regex greediness. A single `extract(field)` regex that uses `\s*$` will
capture the next line's content when the value is empty. ADV #2
(empty `classified_as:`) will surface this as
`classified_as_invalid: "specialist_loaded: edge-research-code"` instead
of `classified_as_invalid: ''`. Fix by parsing line-by-line instead of
one regex across the whole file.

## The schema that survives ledger growth

`results.tsv` columns (frozen, enforced by `harness.py`):

```
generation  experiment  baseline_kind  harness_hash  artifact_hash
primary_score  max_score  blocking_failures  worst_case_delta
per_case_scores  status  duration_s  calls  tokens  cost_usd
preflight_hash  classified_as  preflight_ok  description
```

Deduplicate on `(generation, experiment)` — keep the latest write. The
ledger is the audit trail; duplicates are noise.

## When NOT to use this pattern

- If you have <30 minutes and the rubric is fine. Self-judging on a
  reasonable rubric is faster.
- If the artifact is purely deterministic (build, test, benchmark) —
  the rubric saturating there is normal because deterministic gates
  have a binary truth value.
- If you can't dispatch a sub-agent (no delegation available). Without
  isolation, this pattern collapses to single-judge bias again.

## Worked example

`examples/router-self-eval/` holds a harness and rubric built to be
copied into a judge bundle (`--scenarios-path scenarios.md` lets it run
from the bundle root). In the run that shaped this pattern, the
independent judge scored 35/40 against the running session's 40/40, and
that −5 divergence was the most valuable signal in the run.