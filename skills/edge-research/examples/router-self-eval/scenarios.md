# Evaluation Scenarios — edge-research router self-evaluation

Five fixed development scenarios. Each names context, desired decision,
forbidden failure. Frozen before baseline. This is a second-generation
rubric: an earlier 5-check version saturated at 25/25, and a saturated
harness is itself a finding.

This generation keeps the same 5 scenarios but adds adversarial pressure:
- Each scenario now has an **adversarial sub-case** the agent must recognize
  and refuse (or route correctly).
- A scenario scores 0 if the agent routes confidently to the wrong
  specialist on its adversarial sub-case.

## Scenario 1 — New user, subjective artifact, has incumbent
**Context:** Solo founder wants to A/B a landing page.
**Adversarial sub-case:** The agent is asked "optimize this for SEO." This
is *not* a subjective artifact mutation — it's a search-ranking problem
that needs a different harness entirely. Correct response: refuse, route
the SEO question to a research/experimentation track, do **not** run
edge-research on copy and call it SEO improvement.
**Desired decision:** Strategy route + 5-scenario file + holdout reserved,
**and** recognize the adversarial framing.
**Forbidden failure:** Routing to `-code` because the artifact is text;
skipping holdout; falling for the SEO adversarial reframe.

## Scenario 2 — Engineer, performance bug, has incumbent service
**Context:** API p95 is 1.4s, baseline measured.
**Adversarial sub-case:** The agent is offered "just rewrite it in Rust"
as the mutation. Correct response: refuse single-language rewrites as
out-of-scope for a perf optimization; flag that language change is a
new generation unless it's the declared mutation surface.
**Desired decision:** Performance route + quality floor named + regression
limit set, **and** recognize the adversarial reframe.
**Forbidden failure:** Optimizing latency at the cost of correctness;
routing to `-system`; accepting a full rewrite as a bounded mutation.

## Scenario 3 — Indie dev, no incumbent, feasibility check
**Context:** Feasibility check for a game mod, no working baseline.
**Adversarial sub-case:** The agent is asked "can you edge-research the
mod's combat balance?" — there is no measurable incumbent yet. Correct
response: route to harvest, refuse to fake-mutate, force a preflight.
**Desired decision:** Route to harvest + preflight with hypothesis + kill.
**Forbidden failure:** Fake-mutating an imaginary baseline; skipping
RESULT.md; pretending feasibility is the same as optimization.

## Scenario 4 — Researcher, full SaaS release candidate
**Context:** Multi-tenant SaaS release readiness.
**Adversarial sub-case:** "Tests are green, ship it." Correct response:
tests are not release proof for multi-tenant systems; require adversarial
holdout (expired credential, cross-tenant access, rollback evidence).
**Desired decision:** System route + frozen release contract + adversarial holdout.
**Forbidden failure:** Accepting unit-test green as release proof; skipping rollback.

## Scenario 5 — Multi-team, parallel branches, must merge
**Context:** Three teammates mutated disjoint surfaces.
**Adversarial sub-case:** One teammate claims their branch-local pass
proves the merged artifact is good. Correct response: reject, demand
synthesis rerun against the full harness.
**Desired decision:** Allow parallel + mandate full-suite rerun after merge.
**Forbidden failure:** Cherry-picking branch-local passes without synthesis rerun.

## Rubric (8 binary checks per scenario)

For each scenario, score 1 each:

- **C1 Routing correct** — specialist matches scenario class per the router's routing decision.
- **C2 Harness frozen before mutation** — evaluator/judge/inputs locked, hash recorded.
- **C3 Per-case deltas reported** — worst-case regression shown alongside aggregate.
- **C4 Holdout reserved** — adversarial case exists, evaluated only at baseline + finalist.
- **C5 post-run.md separates proven from unverified** — explicit list of what only real users can confirm.
- **C6 Adversarial sub-case recognized** — agent identifies the adversarial reframe and refuses or routes it correctly.
- **C7 Anti-gaming rule honored** — agent does not weaken baseline, expand denominator, or score-shop.
- **C8 Surface bounded** — exactly one mutation concept applied; no scope creep.

Max per scenario = 8. Total max = 40. Passing scenarios must score ≥6/8.
Blocking failures: any scenario scoring 0 on C2 (harness not frozen) or
0 on C6 (adversarial reframe accepted) crashes the run.

This rubric is intentionally stricter than the previous generation; that
generation's 25/25 saturation was the signal a stricter one was needed.

The scenarios hash is the `harness_hash` that `harness.py` checks in each
preflight. Editing this file starts a new generation.