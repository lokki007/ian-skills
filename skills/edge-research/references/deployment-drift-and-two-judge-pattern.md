# Deployment Drift + Two-Judge Pattern (system-class extensions)

Four failure modes that are system-boundary or harness-design concerns
rather than routing concerns. Load this when the artifact under test is
deployed (a skill, prompt, or configuration file in a live tree) or when
a rubric has saturated.

## 1. Live-Artifact Drift Closure

When the artifact under test is a deployed skill, prompt, or configuration
file in a live tree (e.g. `<agent-home>/skills/edge-research/SKILL.md`),
the candidate can pass every gate while the deployed artifact is stale.
A validated candidate may be kept locally. Claim deployment only after
verifying the live artifact.

Treat the live tree as a system boundary and add this step to every
experiment workflow that touches a deployed artifact:

1. After a `keep` row is written, hash the file at the live path.
2. If the live hash does not match the keep row's `artifact_hash`,
   report a locally validated keep awaiting authorized promotion; do not
   claim deployment.
3. Only when promotion to this target is authorized, preserve unrelated
   drift and back up before promotion:
   `cp <live> <run>/baseline/<name>.exp-NN-pre-promotion`
4. Swap. The backup is your rollback if the deployed version had
   unrelated drift you didn't intend to overwrite.
5. Re-run the harness against the *now-live* file with an explicit
   override (e.g. `--allow-live-router`) and confirm all gates still
   pass post-promotion.
6. Document pre/post hash in the changelog.

The companion `live_router_pin` pattern (see
`examples/router-self-eval/harness.py`, `--live-tree` /
`--allow-live-router`) refuses to score candidates under the live tree
without the explicit override. This prevents accidental live-file
mutation during the experiment itself. The defect class it closes: an
independent judge edits the live router on disk as part of its scoring,
silently growing it past the size gate while the experiment copy stays
clean.

## 2. Two-Judge Minimum for Saturated Rubrics

One independent judge catches defects the running session missed.
**It does NOT confirm patches closed them.** Inter-rater reliability
needs ≥2 judges on the *post-patch* artifacts; one judge on pre-patch
+ one on post-patch conflates "defects caught" with "defects closed."

The pattern:

- **Judge #1 (pre-patch).** Scores the bundled artifacts with no prior
  context. This gives the rubric's first divergence signal (e.g. 35/40
  vs the running session's 40/40, Δ=−5).
- **Patch.** Apply the structural fixes the judge surfaced.
- **Judge #2 (post-patch, fresh context).** Re-scores the patched bundle.
  Aggregate Δ → 0 within ±2 per scenario means the patches genuinely
  closed the defects.

If only one judge is affordable, run it *post-patch*. Treat any
pre-patch defects surfaced by re-reading the rubric as evidence the
rubric was saturated, not as a confirmed bug inventory.

**Why two judges, not one:** with one judge, you cannot distinguish
"the patches worked" from "the rubric was always easy on this set."
The judge #1 vs judge #2 Δ on the same patched artifacts is the
signal that has external validity.

**Pitfall — judging the wrong thing:** judge #2 may score the bundle
post-patch but with stale hashes. Force a fresh sub-agent context for
judge #2 (different session, no prior context) and require it to verify
the artifact hashes it sees match the keep row.

## 3. Adversarial-Gate Anchoring (substrings vs structural markers)

A gate that requires a phrase like `"Adversarial Sub-case Recognition" in text`
passes on routers that mention the phrase in prose without an actual
section — a fixture router with the phrase in a sentence passes.

Fix: anchor to the structural marker (`## Adversarial Sub-case Recognition`
— the H2 prefix), not the bare substring:

```python
rules["adversarial_inline"] = "## Adversarial Sub-case Recognition" in text
```

Test: a router that has the phrase in prose and no H2 must fail the gate.
A router that has the H2 must pass.

Generalize: any gate that depends on the *presence of content* should
depend on the *presence of a structural marker for that content*,
not on the content itself. Bare-substring gates are defeat-by-prose.

## 4. Path-Content Predicates, Not Leaf-Name Predicates

A gate conditioned on `candidate_path.name == "SKILL.md"` lets bundle
conventions like `SKILL-router.md`, `SKILL-<variant>.md`, or
`SKILL-exp-NN.md` bypass it. A judge bundle that ships the router as
`SKILL-router.md` skips the size gate entirely.

Fix: fire on substring predicates against the *full path*
(`"edge-research" in str(candidate_path)`), not the leaf filename.

```python
# WRONG: bypassed by SKILL-router.md
if candidate_path.is_file() and candidate_path.name == "SKILL.md" and "edge-research" in str(candidate_path):
    rules["router_size_chars"] = len(text) <= ROUTER_MAX_CHARS

# RIGHT: fires on any edge-research candidate regardless of leaf
if candidate_path.is_file() and "edge-research" in str(candidate_path):
    rules["router_size_chars"] = len(text) <= ROUTER_MAX_CHARS
```

Verify by passing a candidate with a renamed leaf — it must still be gated.

## Reproduction

`examples/router-self-eval/` implements all four: the live-artifact pin,
the H2-anchored adversarial gate, the full-path size gate, and the
frozen 5-scenario rubric the two judges score against.
