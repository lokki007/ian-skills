---
name: edge-research-strategy
description: Use after the edge-research router classifies a run as strategy, copy, prompt, plan, offer, or other subjective knowledge work. Builds persona-grounded frozen evals, pairwise judging, factuality gates, and decision-ready holdouts without pretending rubric scores prove business outcomes.
license: MIT
metadata:
  version: "1.0.0"
  tags: [edge-research, strategy, prompts, copy, evaluation]
  related_skills: [edge-research, edge-research-code, edge-research-system, edge-research-performance, edge-research-harvest]
---

# EdgeResearch Strategy
## Overview

Optimize subjective artifacts with disciplined comparison rather than vibes. Load `edge-research` first; this skill owns only strategy/copy/prompt/plan-specific harness design and evidence.

## When to Use

Use for prompts, positioning, offers, plans, briefs, onboarding, scripts, and copy where deterministic tests cannot establish usefulness. Do not use for executable code, release systems, pure performance work, or prototypes without an incumbent.

## Harness Design

1. Define five fixed development scenarios spanning normal, edge, and wrong-fit users. Completion: each scenario names context, desired decision, and forbidden failure.
2. Add at least one holdout persona or adversarial prompt unseen during mutation. Completion: stored separately and evaluated only at baseline/finalist.
3. Use 3–6 independent binary checks per scenario. Typical checks: factual accuracy, audience fit, specificity, decision readiness, implementation clarity, refusal/scope discipline.
4. Mark source truth, safety, legal/financial claims, and invented capabilities as blocking.
5. Freeze the evaluator prompt, model/provider, source packet, scoring weights, and tie policy; hash them before baseline.

## Evaluation Method

Prefer blinded pairwise comparison against the real baseline or incumbent. Randomize A/B order and strip variant names. Require the judge to cite exact evidence from the output for every failed check.

Use multiple personas only when they represent real audience segments. Do not average away a catastrophic persona failure; record worst-case results separately.

A candidate is keepable only when:

- no blocking check regresses;
- primary pass count improves, or quality ties with material simplification;
- no protected scenario exceeds the declared regression limit;
- factual claims remain grounded in the frozen source packet.

## Mutation Surfaces

Change one bounded surface per experiment: instruction ordering, one ambiguity, one example, one schema field, one proof block, one objection, or one refusal rule. Broad rewrites are a new branch or generation, not a fake single mutation.

## Anti-Gaming

- Topic mention is not usefulness.
- Longer is not better; track length or decision time as a secondary metric.
- A judge score does not prove conversion, adoption, or revenue.
- Repeated 100% triggers scrutiny: finish if the goal is met; start a stricter generation only for a concrete uncovered requirement within scope and the remaining hard budget.
- Do not tune directly against holdout failures.
- Run a fresh independent judge on finalists when stakes are high.

## Required Outputs

Alongside the router ledger, store:

- `evals/scenarios.md` with five development scenarios;
- `holdouts/` with unseen persona/adversarial cases;
- `evals/judge-prompt.md` and model/provider metadata;
- per-scenario pass/fail evidence;
- blinded pairwise transcripts for kept candidates;
- `post-run.md` naming the real-user/business outcome still unverified.

## Common Pitfalls

1. **Generic rubric:** “clear and compelling” is mush. Replace it with observable decisions or required evidence.
2. **Persona theater:** invented personas without source evidence only add noise.
3. **Judge drift:** changing the judge prompt/model mid-generation invalidates comparability.
4. **Average-score masking:** report worst persona and blocking failures before aggregate score.
5. **Business overclaim:** rubric wins are candidate quality, not market proof.

## Verification Checklist

- [ ] Router classified the run as strategy.
- [ ] Five fixed development scenarios and at least one holdout exist.
- [ ] Judge, source packet, weights, and tie policy are frozen and hashed.
- [ ] Blocking factuality/scope checks cannot be offset by style points.
- [ ] Finalist received blinded independent review.
- [ ] `post-run.md` states what only real users can validate.
