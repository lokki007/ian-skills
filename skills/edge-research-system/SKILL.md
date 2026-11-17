---
name: edge-research-system
description: Use after the edge-research router classifies a run as full-system or release optimization. Evaluates auth, persistence, tenant isolation, migrations, live integrations, observability, rollback, and destructive-action safety with end-to-end evidence instead of accepting component tests as release proof.
license: MIT
metadata:
  version: "1.0.0"
  tags: [edge-research, system, release, integration, rollback]
  related_skills: [edge-research, edge-research-strategy, edge-research-code, edge-research-performance, edge-research-harvest]
---

# EdgeResearch System
## Overview

Optimize a complete system or release contract. Load `edge-research` first. This mode is stricter than code optimization because local component correctness cannot prove identity boundaries, persistence, deployment, integrations, or recovery.

## When to Use

Use when success spans multiple services or depends on auth, database state, tenant isolation, migrations, queues, external providers, deployment, rollback, or observability. Use `edge-research-code` for a bounded executable component.

## Release Contract

Before baseline, freeze:

1. supported user/tenant roles and forbidden cross-boundary actions;
2. critical end-to-end journeys and expected persisted state;
3. migration/seed version and data preservation requirements;
4. integration modes: mocked, sandbox, or live;
5. rollback/recovery target and destructive-action policy;
6. observability signals required to diagnose failure;
7. environment/deployment target and artifact versions.

Completion: every critical journey maps to an executable check and a required evidence tier.

## Blocking Gates

Treat these as lexicographically first:

- auth or authorization bypass;
- tenant/user data leakage;
- data loss or non-idempotent destructive behavior;
- failed migration without verified recovery;
- persistence failure across process restart;
- unrecoverable deployment or rollback failure;
- silent integration failure without observable signal;
- secrets exposure.

No average quality score can offset one of these failures.

## Evidence Ladder for Systems

- Component tests prove local contracts.
- Integration tests prove selected seams.
- Runtime E2E proves one environment and fixture.
- Sandbox/live-provider tests prove actual provider behavior at that moment.
- Production or real-user outcomes remain separate unless explicitly exercised.

Label mocks and stubs. Never report a mocked provider as live verification.

## Experiment Workflow

Mutate one system boundary per experiment: auth policy, transaction boundary, retry/idempotency behavior, migration step, queue semantics, deployment config, observability signal, or rollback path.

Capture before/after state, requests/events, persisted records, service logs, deployment artifact IDs, and recovery result. Any partial execution that leaves uncertain state is `crash` or blocking failure until reconciled.

Parallel mutation is usually unsafe for shared environments. Use isolated stacks/databases/tenants and unique namespaces, or serialize.

## Holdouts and Failure Injection

Reserve at least one adversarial system case for finalists: expired credential, duplicate webhook, network timeout, process restart, migration interruption, stale client, cross-tenant identifier, or provider error.

When safe, inject one recoverable failure and verify observability plus recovery. Never run destructive failure injection against production without explicit user approval and a verified backup/rollback.

## Required Outputs

- frozen release contract and environment manifest;
- E2E command/runbook;
- state snapshots before and after critical journeys;
- migration and rollback evidence;
- live/sandbox/mock labels for each integration;
- logs/metrics proving failure visibility;
- unresolved production or real-user verification in `post-run.md`.

## Common Pitfalls

1. **Component fallacy:** green unit tests are not release proof.
2. **Mock laundering:** state the provider tier on every claim.
3. **Happy-path tunnel vision:** reserve failure and isolation holdouts.
4. **Shared-state collision:** parallel workers need isolated environments.
5. **Rollback theater:** a documented command is not a verified rollback.

## Verification Checklist

- [ ] Router classified the run as full system/release.
- [ ] Critical journeys and blocking boundaries are frozen.
- [ ] Auth, isolation, persistence, migrations, and rollback are exercised where relevant.
- [ ] Integration evidence is labeled mock/sandbox/live.
- [ ] At least one adversarial/failure holdout ran safely.
- [ ] Production/real-user unknowns remain explicit.
