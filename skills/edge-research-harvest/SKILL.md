---
name: edge-research-harvest
description: Use when a prototype, spike, proof of concept, or exploratory build has no stable incumbent and therefore is not true edge-research. Runs the smallest real proof, captures evidence and failure, extracts transferable lessons, and forces a continue, pause, or kill decision so experiments do not become artifact graveyards.
license: MIT
metadata:
  version: "1.0.0"
  tags: [experiment, prototype, spike, learning, decision]
  related_skills: [edge-research, edge-research-strategy, edge-research-code, edge-research-system, edge-research-performance]
---

# Experiment Harvest

## Overview

A prototype is hypothesis testing, not an edge-research mutation loop. Use this when there is no measured incumbent or frozen comparable artifact. The output is a decision and reusable evidence—not a fake improvement curve.

## When to Use

Use for throwaway prototypes, spikes, feasibility tests, new integrations, unfamiliar libraries, design explorations, and “can this work?” builds. Do not use when a named artifact already has a reproducible baseline and can be optimized through comparable mutations; route that through `edge-research`.

## Preflight

Write before building:

1. **Hypothesis:** one falsifiable sentence.
2. **Unknown:** the single riskiest thing being tested.
3. **Smallest proof:** the minimum real execution that resolves it.
4. **Evidence:** exact output, behavior, measurement, or screenshot/log required.
5. **Budget:** time/cost limit.
6. **Kill condition:** result that ends the idea.
7. **Out of scope:** features deliberately excluded.

Completion: another person can state what result means continue versus kill.

## Execution

Build the laziest artifact that exercises the real uncertainty. Stubs and mocks are allowed only for non-target dependencies and must be labeled. If the unknown is a live integration, call the live/sandbox integration; a mocked response proves nothing about it.

Run the artifact. Capture commands, versions, logs, screenshots, timings, URLs, files, and failures as relevant. Do not polish beyond the evidence needed to decide.

If the experiment uncovers a different higher-risk unknown, record it; do not quietly redefine success.

## Harvest Contract

Create `RESULT.md` beside the prototype:

```text
Hypothesis:
Unknown tested:
What ran:
Environment:
Proof:
Result:
What failed:
Transferable lesson:
Decision: continue | pause | kill
Why:
Next experiment:
Artifact paths:
```

The decision is mandatory:

- **continue** — evidence supports a bounded next build or true edge-research baseline;
- **pause** — potentially viable, but blocked by a named prerequisite/owner;
- **kill** — hypothesis failed or expected value is below the cost.

## Promotion to EdgeResearch

Promote only when:

- a real working artifact exists;
- one objective and mutable surface are named;
- a reproducible harness can measure the current artifact;
- development and holdout cases can be frozen;
- experiment `0` will be the real artifact, not a synthetic weak control.

The prototype's result is historical evidence, not automatically the new harness.

## Cleanup

Label throwaway artifacts clearly. Preserve only what supports the decision: source, minimal setup, proof, and `RESULT.md`. Remove secrets, generated junk, and misleading dead instructions. Archive or delete only within the approved scope.

## Common Pitfalls

1. **Prototype theater:** code that never ran is not evidence.
2. **Mock laundering:** mocks cannot prove the target integration.
3. **Scope creep:** polishing UI before proving the core unknown wastes the budget.
4. **No decision:** “interesting” is not a result.
5. **Fake edge-research:** without incumbent + frozen evaluation, there is no keep/discard curve.
6. **Artifact graveyard:** no `RESULT.md` means the learning will be lost.

## Verification Checklist

- [ ] Hypothesis, unknown, proof, budget, and kill condition were written first.
- [ ] The real uncertainty was exercised, not merely described.
- [ ] Evidence paths and commands are reproducible.
- [ ] `RESULT.md` includes failure and transferable lesson.
- [ ] Decision is exactly continue, pause, or kill with a reason.
- [ ] Promotion to edge-research occurs only after a measurable incumbent exists.
