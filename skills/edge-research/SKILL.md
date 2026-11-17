---
name: edge-research
description: "Use EdgeResearch when autonomously improving a named artifact through measurable experiments. Single router: verifies a real baseline and frozen evaluation, classifies the run, then loads exactly one specialist."
license: MIT
metadata:
  version: "5.0.0"
  tags: [edge-research, optimization, evaluation, experiments, router]
  related_skills: [edge-research-strategy, edge-research-code, edge-research-system, edge-research-performance, edge-research-harvest]
---

# EdgeResearch Router

> Freeze the eval. Mutate one surface. Measure. Keep or revert. Verify outside.

This router decides *which* specialist to load. Protocol, evidence ladder, parallel-lane discipline, and crash recovery live in `references/`, loaded only on specific failure modes.

## Routing Decision

Evaluate all applicable criteria before selecting one specialist. No measurable incumbent selects `edge-research-harvest`. Otherwise system-boundary or release acceptance selects `edge-research-system`; performance objectives with protected correctness select `edge-research-performance`; remaining executable/UI work selects `edge-research-code`; remaining subjective work selects `edge-research-strategy`.

Merged-artifact acceptance requires checks against the merged result, not just branch-local evidence. State the selected classification and reason briefly.

## Adversarial Sub-case Recognition (in-router, always loaded)

A request that *looks* like an edge-research target may be a reframe. The router must recognize and refuse or reroute — these are NOT scored by the ladder alone.

- **SEO reframe.** "Optimize for SEO" is a search-ranking problem, not a subjective-artifact mutation. Route to research, not edge-research on copy.
- **Language rewrite reframe.** "Rewrite in Rust" is a new generation, not a bounded mutation. Refuse unless language change is the declared surface.
- **Green tests ≠ release proof.** Multi-tenant / auth / isolation / migration / rollback systems require adversarial holdout (expired credential, cross-tenant access, rollback evidence). Unit green is necessary, not sufficient.
- **Branch-local pass ≠ synthesis pass.** If parallel branches exist, demand a full-harness rerun against the merged artifact. Cherry-picking branch-local results is forbidden.

Match any of these → refuse confidently and route to the correct track; do not let the ladder force a fit.

## Mandatory Routing Decision Record

Write to `runs/<name>/preflight.md` before any mutation:

```
classified_as: <strategy|code|system|performance|harvest>
classification_rationale: <one sentence citing the routing questions>
specialist_loaded: <edge-research-{x}|edge-research-harvest>
harness_frozen_at: <UTC ISO8601>
harness_hash: <sha256>
```

A run without a recorded classification is a crash, not retry-until-green.

## Per-run Artifacts (Mandatory)

Files in `runs/<name>/`: `preflight.md` (10-item template), `harness.py` (writes one `results.tsv` row; no LLM in scoring loop), `results.tsv` (schema enforced by `harness.py`), `changelog.md` (hypothesis, mutation, metric vector, per-case deltas, evidence tier, keep/discard/crash reason), `post-run.md` (three sections: "what improved" / "what didn't" / "real-world still unverified").

Expose reproducible baseline, mutation, evaluation, and diff commands using the existing task runner or a small script. A Makefile is optional.

## Four-Step Protocol (the whole loop)

1. **Freeze** — evaluator + inputs + scenarios + holdout. Hash and date.
2. **Mutate** — exactly one bounded surface.
3. **Measure** — run the frozen harness, write one `results.tsv` row.
4. **Decide** — keep on measured improvement with no protected regression; revert otherwise.

## When the harness saturates

A saturated harness may mean the goal is met or the evaluation lacks a relevant case. Report which the evidence supports. Start a new generation only for a concrete uncovered requirement within scope and remaining hard budget. Never weaken the artifact to manufacture improvement.

## Three structural-gate pitfalls (always loaded)

These three defect classes bit real runs and are easy to repeat. Encode the rules in `structural_rules()` so the harness enforces them, not the rubric reader.

1. **Substring gates are defeatable.** A gate that requires a phrase like `"Adversarial Sub-case Recognition" in text` passes on routers that mention the phrase in prose without an actual section. Anchor to a structural marker (`## Adversarial Sub-case Recognition` — the H2 prefix), not the bare substring. Test with a router that has the phrase in prose and no H2 — it must fail the gate.
2. **Path-content predicates, not leaf-name predicates.** A gate conditioned on `candidate_path.name == "SKILL.md"` lets bundle conventions like `SKILL-router.md` or `SKILL-<variant>.md` bypass it. Fire on substring predicates against the *full path* (`"edge-research" in str(candidate_path)`), not the leaf filename. Verify by passing a candidate with a renamed leaf — it must fail the gate.
3. **Deployment drift closes the gap on paper only.** A bundle can pass every gate while the deployed artifact is stale (different hash). Treat the live-skill tree as part of the experiment: after a keep row is written, hash the deployed file at the live path. If the live hash does not match the keep row's `artifact_hash`, the experiment is incomplete — promote only when deployment is authorized, with a backup and re-verification; otherwise report the validated candidate as awaiting promotion. The `live_router_pin` pattern (`--allow-live-router` override to score under live skill tree) catches and prevents silent drift.

## Two-judge minimum for saturated rubrics

One independent judge catches defects the running session missed. **It does NOT confirm patches closed them.** The pattern is: judge #1 scores and surfaces defects → patch → judge #2 with fresh context re-scores → confirm aggregate Δ → 0 within ±2 tolerance per scenario. Inter-rater reliability needs ≥2 judges on the *post-patch* artifacts; one judge on pre-patch + one on post-patch conflates "defects caught" with "defects closed."

If only one judge is affordable, run it *after* patches, not before — and treat any pre-patch defects surfaced by re-reading the rubric as evidence the rubric was saturated, not as confirmed bug inventory.

## Heavy detail (load on demand)

- `references/protocol.md` — anti-gaming, evidence ladder, metric vector, parallel-lane rules, crash recovery, lessons from past runs.
- `references/running-it-for-real.md` — end-to-end run recipe: preflight gate in code, adversarial preflight fixtures, regex-greediness gotcha.
- `references/independent-judge-pattern.md` — judge bundle, strict brief, fresh sub-agent, divergence comparison. Load when a rubric saturates.
- `references/deployment-drift-and-two-judge-pattern.md` — live-artifact drift closure, two-judge minimum, adversarial-gate anchoring, path-content predicates. Load when the artifact under test is deployed or the rubric saturated.
- `references/multi-lane-research-recovery.md` — recovering parallel lanes that share a failed dependency.

Templates and scripts: `templates/` and `scripts/` (see `templates/README.md`). Worked example harness with preflight, structural and live-pin gates: `examples/router-self-eval/`.
