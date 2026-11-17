---
name: pareto-dev
description: "Prioritize substantial software diagnosis, audits, or competing implementation options by impact, effort, and risk. Use ordinary scoped verification for routine fixes without a separate Pareto report."
license: MIT
---

# Pareto Dev

Use 80/20 to decide what matters, act on the few changes that move the goal, and leave the rest alone.

Core promise: less code, fewer guesses, more verified impact.

## Rules

1. Detect mode first: bug, feature, refactor, review, performance, audit, or mixed.
2. Read local code before judging. Prefer existing patterns, helpers, tests, and style.
3. Rank by impact, speed, and risk reduction.
4. Keep blast radius small. Identify the smallest evidence-backed surface controlling the outcome.
5. Delete only with proof: dead, duplicate, unreachable, or unused code.
6. Verify changed behavior. If a check cannot run, say why and use the best alternate check. For bug fixes, changed non-trivial behavior, or high-risk deterministic logic, apply [behavioral regression and selective mutation checks](references/regression-testing.md); preserve required broader gates.
7. Stop when the goal is met. Do not polish the unaffected code.

## Elephant-Goldfish design gate

For a substantial feature with unresolved architecture, or a requested specification review, automatically apply the Elephant-Goldfish discipline before implementation: the context-rich author writes the smallest useful self-contained design; a fresh reviewer reads that document and its cited sources without the parent conversation. Keep ordinary clear bug fixes on the existing short path.

- Reuse an existing design/brief; create no atlas, specialist chain, or paperwork solely to activate this gate. Record the goal, constraints, trade-offs, interfaces, failure/rollback cases, and acceptance checks only where useful.
- Pass reviewers absolute document/source paths, explicit review criteria, and the relevant reviewer personas or standards. Never send the parent transcript, private reasoning, or memory-derived answers. Use real fresh-context controls (for example a new subagent). If they are unavailable, stop the Goldfish review and report the limitation; same-context self-review is not equivalent.
- Reconcile evidence-backed findings, surface unresolved trade-offs for the user, and obtain required design approval before implementation. Preserve user scope, existing model routing, permissions, and security gates; review never replaces tests.
- If an Elephant-Goldfish plugin or skill set is installed (for example brainstorm, draft and review skills), use it for the full interactive workflow, and keep its own approval steps intact. Do not silently auto-launch an interactive workflow the user has not invoked.
- Resolve personas and standards from the installed bundle you are actually using, not from similarly named project files. Fresh-context isolation does not prove host-instruction or filesystem isolation; disclose what was actually tested.

Source: Google's [Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model), Apache-2.0. This section is scoped integration guidance, not a copy of that project.

## Mode Router

| Mode | Flow |
| --- | --- |
| Bug | Reproduce -> isolate -> smallest patch -> regression check |
| Feature | User flow -> edge scan -> scope cut -> core path -> acceptance check |
| Refactor | Behavior contract -> tests/inspection -> one boundary -> stable API |
| Review | Findings first -> severity -> file/line evidence -> no edits unless asked |
| Performance | Measure or infer hot path -> smallest bottleneck fix -> before/after |
| Audit | Pareto map -> now/later/maybe/never -> no edits unless asked |

## Pareto Map

Build only the inventory needed for the decision; a routine fix needs no table.

| Band | Meaning | Move |
| --- | --- | --- |
| Core | Small surface that decides the result | Protect, test, sharpen |
| Healthy | Valuable code that already works | Leave unless it blocks the goal |
| Weak | Fragile, confusing, slow, or costly code | Simplify after core is safe |
| Drag | Proven dead weight or active risk | Remove only with evidence |
| Outside scope | Not material to this goal | Do not touch |

Use this row shape when useful:

`Component | Role | Impact | Effort | Risk | Band | Decision`

## Edge Scan

Inspect plausible failure paths affected by the change. Use no minimum count or mandatory output table. Expand coverage for money, authorization, persistence, concurrency, or other material risk.

## Action Order

1. State the goal and only the constraints, user needs, and uncertainties that change the decision.
2. Find evidence: failing test, logs, trace, source path, UX path, benchmark, or PR diff.
3. Cut proven drag only when proven safe.
4. Fix the core issue with the smallest sufficient change set.
5. Harden the affected core with tests, errors, types, contracts, or clearer boundaries.
6. Report changes, remaining work, risks, and how to verify.

## Priorities

- Now: high impact, fast enough, risk controlled, tied to the goal.
- Later: useful, but not needed for the current outcome.
- Maybe: promising, but blocked by missing evidence or unclear value.
- Never: low impact, high churn, speculative, or mostly aesthetic for a code task.

Reject a dependency, subsystem rewrite, public behavior change, or scope expansion unless it clearly beats the smaller path on impact, speed, and risk.

## Output Contract

Select only the following fields that help the requested audit, plan, or report; do not emit a template for routine fixes:

- Goal: one sentence.
- Constraints: platform, time, technical limits, existing system limits, compliance/legal if relevant.
- Assumptions: known facts separate from guesses; mark fragile assumptions.
- User lens: who it is for, what they want, what they fear, what friction must disappear.
- Edge scan: top risks before implementation.
- Pareto map: component, band, decision, why.
- Recommended path: now, later, maybe, never.
- Decision record: why this path wins, what lost, what evidence would prove it wrong.
- Changes made: files and behavior changed, or "no code changes" for reviews/audits.
- Verification: tests, checks, screenshots, benchmarks, or reason not run.
- Risks: likely breakpoints, dependencies, compatibility risks.
- Acceptance checklist: core path works, edge cases handled, existing behavior preserved, verification recorded.

## Quality Bar

A good Pareto Dev result is specific, small, and checkable. It names the few files that matter, explains why other work lost, changes only what the goal needs, and leaves the user with a clear acceptance checklist.

Avoid generic advice, long inventories for small tasks, invented metrics, unsafe deletion, speculative rewrites, and "80/20" labels without evidence.
