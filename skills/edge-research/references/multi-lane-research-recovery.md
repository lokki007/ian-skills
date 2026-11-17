# Multi-lane generative EdgeResearch recovery

Use this pattern when independently delegated content/UI lane audits share one failed research dependency or time out before returning summaries.

## Bounded recovery

1. Check each declared output path before rerunning; a timed-out leaf may have written a valid artifact without returning a summary.
2. Inspect live transcripts only long enough to identify the common dependency. Mark the attempt `crash`; it is not a lane verdict.
3. Fetch a small named evidence set once at the parent through a working direct path. Store source URL, status, and concise extracts in a shared cache. Cache evidence, not conclusions.
4. Split the frozen corpus into compact lane-only fixtures. Preserve corpus/harness hashes and keep holdouts inaccessible.
5. Re-dispatch leaves with the failed network tools forbidden, exact local reads, disjoint output directories, strict output/tool budgets, and required read-back verification.
6. Parent-verifies JSON parsing, score arithmetic, selected-experiment counts, output paths, and absence of production edits.
7. Freeze proposals before implementation. Add RED contracts, mutate one conceptual surface per lane, run real-provider development cases, then holdout and an independent reviewer.

## Recovery prompt skeleton

```text
Recovery run after shared research infrastructure failed.
RESEARCH-ONLY; do not edit production files.
Do not call <failed lookup tools>; evidence is cached locally.
Read only: <frozen rubric>, <lane fixture>, <named source extracts>, <exact source ranges>.
Audit every declared field across every frozen case.
Write only <lane>/baseline-audit.md and experiment-proposal.json.
Select exactly one backend and one UI experiment; read both files back.
Finish before extra exploration.
```

Do not persist a negative claim that a tool is broken. The durable lesson is to centralize shared evidence acquisition and bound the retry path.
