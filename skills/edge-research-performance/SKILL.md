---
name: edge-research-performance
description: Use after the edge-research router classifies a run as cost or performance optimization. Holds quality and correctness as hard floors while measuring latency, throughput, memory, calls, tokens, cost, and complexity with warmups, repeated trials, per-case regression limits, and selective live-provider validation.
license: MIT
metadata:
  version: "1.0.0"
  tags: [edge-research, performance, cost, latency, benchmark]
  related_skills: [edge-research, edge-research-strategy, edge-research-code, edge-research-system, edge-research-harvest]
---

# EdgeResearch Performance
## Overview

Optimize resource use without buying speed by breaking quality. Load `edge-research` first. This mode uses a lexicographic contract: correctness and quality floors first, performance/cost second.

## When to Use

Use for latency, throughput, memory, binary size, model calls, tokens, provider cost, retries, dependency count, or operational complexity. If the primary objective is feature behavior or release correctness, route to code/system and track performance as secondary.

## Metric Contract

Freeze before baseline:

1. protected correctness/quality suite and minimum acceptable floor;
2. primary resource metric and units;
3. representative workload with labeled case provenance;
4. warmup, repetitions, timeout, concurrency, and environment;
5. aggregate statistic: median or trimmed mean by default;
6. tail/worst-case statistic such as p95 and maximum per-case regression;
7. materiality threshold for keep decisions;
8. live-provider budget and sampling policy when applicable.

Completion: the benchmark command reproduces baseline raw samples and summary statistics.

## Measurement Discipline

- Pin hardware/runtime/provider/model and record environment noise.
- Warm up caches/JIT before measured trials when relevant.
- Run enough repetitions to expose variance; preserve raw samples.
- Randomize or alternate candidate order when temporal drift matters.
- Report aggregate and per-case deltas.
- Separate cold-start and steady-state results.
- For model/API work, record calls, retries, input/output tokens, latency, errors, and cost.

Do not compare results across changed hardware, provider, model, dataset, or harness as one generation.

## Keep/Discard Rules

A candidate is eligible only if all blocking correctness/quality gates pass. Then keep when:

- the primary resource metric improves beyond the frozen materiality threshold;
- no case exceeds the maximum allowed regression;
- tail latency/error rate remains within limits;
- complexity does not increase disproportionately without documented justification.

Averages never erase a landmine. Equal performance may justify a keep only for measured simplification or reliability improvement.

## Live-Provider Strategy

Expensive live suites should run at baseline, meaningful kept pivots, finalists, and cross-provider validation—not every speculative mutation. Cheap deterministic proxies may guide exploration, but finalist acceptance requires the evidence tier claimed.

Provider/model changes create a new generation unless provider selection itself is the declared mutation surface and the comparison contract freezes all other factors.

## Common Mutation Surfaces

Call-graph cuts, caching, batching, payload/schema compaction, algorithm choice, query/index strategy, retry policy, concurrency, prompt length, context selection, serialization, dependency removal, and lazy loading.

One experiment changes one bounded surface. If optimization changes semantics, it belongs in code/system mode or a new generation.

## Required Outputs

- raw benchmark samples and environment manifest;
- aggregate, tail, and per-case deltas;
- protected quality/correctness results;
- calls/tokens/cost/error records for live providers;
- discarded hypotheses including regressions;
- finalist rerun against original baseline.

## Common Pitfalls

1. **Quality trade laundering:** cheaper but worse fails unless degradation was explicitly allowed.
2. **Single-run noise:** one timing is anecdote.
3. **Average masking:** always report tail and worst case.
4. **Proxy overclaim:** deterministic proxy gains do not prove live-provider savings.
5. **Environment drift:** changed hardware/provider means a new generation.

## Verification Checklist

- [ ] Router classified the run as performance/cost.
- [ ] Quality/correctness floors are blocking and frozen.
- [ ] Warmups, repetitions, environment, and statistics are specified.
- [ ] Raw samples plus aggregate/tail/per-case results exist.
- [ ] Live-provider claims use live-provider evidence.
- [ ] Finalist reran against the original real baseline.
