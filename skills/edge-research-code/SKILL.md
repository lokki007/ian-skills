---
name: edge-research-code
description: Use after the edge-research router classifies a run as code or UI optimization. Builds deterministic tests, runtime/browser evidence, accessibility and responsive gates, mutation worktrees, and full-suite synthesis so source inspection or static HTML cannot masquerade as a working product.
license: MIT
metadata:
  version: "1.0.0"
  tags: [edge-research, code, ui, testing, browser]
  related_skills: [edge-research, edge-research-strategy, edge-research-system, edge-research-performance, edge-research-harvest]
---

# EdgeResearch Code
## Overview

Optimize executable code and UI against frozen deterministic and runtime evidence. Load `edge-research` first; this skill defines code/UI-specific harnesses and acceptance gates.

## When to Use

Use for modules, algorithms, APIs, components, rendering, accessibility, responsive behavior, and developer workflows. Use `edge-research-system` instead when the unit of proof is a whole release with auth, persistence, isolation, rollback, or live integrations.

## Baseline and Harness

1. Pin the real starting commit/tree hash, dependencies, runtime version, fixtures, and environment.
2. Freeze deterministic checks: unit/integration tests, typecheck, lint, build, benchmark, and golden files as relevant.
3. Add runtime checks for any behavior that source inspection cannot prove.
4. For UI, define exact routes, viewport sizes, states, accessibility checks, interaction flows, and screenshot/DOM evidence.
5. Add at least one holdout edge case not exercised during mutation.

Completion: one command or script runs the frozen development harness and exits nonzero on blocking failure.

## Evidence Gates

- Static inspection proves structure only.
- Tests prove only their assertions.
- A build proves compilation, not behavior.
- Static HTML is not running-app verification.
- UI claims require the actual app, route, interaction, and relevant viewport.
- API claims require exercised requests and asserted responses/state changes.

Security, data loss, auth bypass, accessibility blockers, crashes, and build failures are blocking unless explicitly out of scope.

## Mutation Workflow

Use one branch/worktree per disjoint mutation surface. Every experiment records changed files, command output, duration, artifact hash, and per-case regressions. Revert discarded mutations completely.

Parallel branches are allowed only when they do not edit the same files or rely on shared mutable state. The orchestrator must merge finalists into a synthesis branch and rerun the complete harness; branch-local passes do not prove the combination.

## UI-Specific Contract

For each protected viewport/state record:

- route and fixture/account state;
- interaction sequence;
- DOM/accessibility assertions;
- screenshot only as supporting evidence, not the sole assertion;
- console errors and failed network requests;
- responsive overflow/clipping checks.

Visual judge scores may rank finalists, but deterministic interaction and accessibility gates remain lexicographically first.

## Keep/Discard Rules

Keep only when all blocking checks pass and the primary metric improves without exceeding the declared worst-case regression. Equal-quality simplification is keepable when measured: fewer lines/dependencies/calls, lower complexity, or easier maintenance.

Any crash, flaky unexplained result, stale fixture, or harness mismatch is `crash`, not a retry-until-green pass.

## Required Outputs

- reproducible harness command;
- environment lock/provenance;
- baseline and finalist logs;
- per-experiment patch/diff reference;
- runtime/browser artifacts where required;
- synthesis conflict map for parallel branches;
- holdout result and remaining unverified behavior.

## Common Pitfalls

1. **Source-as-proof:** reading code cannot prove runtime behavior.
2. **HMR hallucination:** test a clean build/server when stale hot reload is plausible.
3. **Branch-only success:** always rerun after combining mutations.
4. **Flake laundering:** instability is a finding; do not silently rerun.
5. **Snapshot worship:** screenshots miss behavior and accessibility failures.

