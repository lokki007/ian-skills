# Protocol Detail (loaded on demand)

Heavy detail that the router SKILL.md no longer carries. Load this only when:
- You hit an anti-gaming failure (rubric saturation, mutable denominators, baseline gaming, hidden per-case regressions, prototype result-loss).
- You're running parallel lanes and need the disjoint-files / shared-baseline / synthesis rules.
- You're recovering from a crash and need to validate ledger rows.
- You're training a new specialist and need the full evidence ladder + metric vector definition.

The router SKILL.md is the **decision** (which specialist, what preflight, what shape the run takes). This file is the **guardrails** that prevent the four documented failure modes from recurring.

## Evidence Ladder (full)

1. **Static** — file, AST, schema, or source inspection.
2. **Deterministic** — tests, builds, validators, benchmarks.
3. **Runtime** — exercised process, API, browser, accessibility, or responsive behavior.
4. **Live-provider** — real model/API output with errors, latency, tokens, and cost.
5. **Real-user/business** — adoption, conversion, retention, support burden, explicit user validation.

A claim passes only at the strongest tier it requires. Static HTML cannot prove a running app. Arithmetic tests cannot prove ranking usefulness. Rubric scores cannot prove conversion. Label unresolved outcomes honestly — do not promote a claim to a higher tier than was actually exercised.

## Metric Vector (full)

Every experiment row records all five:

1. **Blocking correctness/safety** — fail this and the row is `discard` regardless of primary.
2. **Primary quality** — the metric the run is named after.
3. **Worst-case regression** — per-case delta, never just an average.
4. **Performance/cost** — duration, calls, tokens, cost_usd where relevant.
5. **Simplicity** — equal quality with fewer lines / fewer dependencies / fewer cases still wins.

## Anti-gaming rules (the four documented failure modes)

1. **Weak-baseline gaming** — never cripple the incumbent to manufacture improvement. A synthetic weak artifact is a separately labeled negative control, never the reported baseline.
2. **Mutable denominators** — never change scoring or scenario count mid-generation. If the harness changes, start `generation-2/` with a fresh baseline.
3. **Rubric saturation** — when the harness stops discriminating, **check whether the goal is met; strengthen the harness only for an uncovered requirement within scope and remaining hard budget**. Do not weaken the artifact. Repeated 100% or unusually high keep rates trigger scrutiny.
4. **Hidden per-case regressions** — never accept averages that hide blocking or per-case regressions. The `worst_case_delta` column is mandatory.

## Parallel mutation rules

Parallel scoring is safe. Parallel **mutation** is not, unless all of:

- Disjoint files / disjoint worktrees.
- One shared frozen baseline + harness hash.
- Separate branch ledgers.
- One decision owner.
- A conflict map maintained.
- A complete synthesis rerun before any finalist is accepted.

For multi-lane audits that share a failed research dependency, see `references/multi-lane-research-recovery.md`: inspect artifacts first, centralize evidence acquisition once, compact lane fixtures, and re-dispatch bounded network-free leaves.

## Crash recovery

Trust a ledger row only when **all three** hold: the output file exists, the hashes match, and the evidence is valid at the tier the claim requires. Otherwise remove or mark the row `crash` and resume from the last valid incumbent. A harness change forces `generation-2/`; never reuse a baseline across an incompatible harness.

## Lessons from past runs

Patterns seen repeatedly across many real optimization ledgers:

- **Synthetic weak baselines reported as the product.** A deliberately crippled 0/N starting point is a negative control, not an honest measure of the incumbent.
- **Maximum score grows inside one ledger** (e.g. 25 → 30 → … → 55). Each change of evaluation semantics needs a new generation and baseline, or rows stop being comparable.
- **All-keep micro-fix ledgers.** Dozens of rows all marked keep at 100% with shifting denominators are an engineering log, not a selection curve. Near-universal keep rates signal weak exploration or missing discard logging.
- **Aggregate wins hiding per-case losses.** A multi-branch prompt optimization cut tokens ~70% and cost ~55% while two of five scenarios got 35–50% slower. Per-case regression gates exist for this.
- **Real selection beats checklist completion.** Comparing materially different hypotheses and discarding the weak ones is stronger pressure than keeping every small additive mutation.
- **Generation restarts done right.** When the requested artifact itself changes shape, start a new generation with a new harness rather than mutating the old one in place.
- **"Research" confused with optimization.** A run of web searches and replanning is not edge-research: there is no incumbent, frozen harness, or keep/discard ledger.
- **Prototype learning loss.** Prototype folders keep code but rarely a verdict; `edge-research-harvest` exists so they leave a `RESULT.md`.
- **Static rubrics overclaiming.** Rubric completion is not conversion, adoption, usability, or escaped-defect evidence; a final 100% still needs a post-run reality check.

## Why this file exists separately

The router SKILL.md should stay a compact page of decision logic so it's fast to load on every classification call. This file is the long-tail guardrail that prevents the same mistakes from recurring. If you find yourself reaching for it on every run, that section belongs back in the router — but only if it materially changes the routing decision.