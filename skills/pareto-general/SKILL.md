---
name: pareto-general
description: Prioritize substantial non-code work when competing inputs, opportunities, or constraints need ranking. Use observed contribution or labeled estimates; do not activate for routine prose or factual questions.
license: MIT
---

# Pareto General

Define the desired output and the relevant inputs. Rank by observed contribution or clearly labeled estimates of impact, effort, and risk. Do not force 80/20 or 4% quotas. If data is insufficient for a ratio, say so.

Lead with the strongest evidence-backed moves. Recurse into that subset only when it changes action. Preserve prerequisites, safeguards, compliance, maintenance, hedges, and learning probes. Remove or defer low-value work only when evidence supports it and the authorized scope allows it.

For quantitative segment estimates, use the curve below. Otherwise a compact qualitative ranking is enough.

## The 80/20 curve (estimates only)

If outputs follow an exact 80/20 Pareto pattern, the share of output from the top fraction `p` of inputs is:

`share(p) = p ^ (ln 0.8 / ln 0.2) ≈ p ^ 0.139`

| Top inputs | Share of output |
| --- | --- |
| 20% | 80% |
| 4% (20% of 20%) | 64% |
| 0.8% | 51% |
| 50% | 91% |

Cautions:

- Real data rarely matches 80/20 exactly. Prefer the observed distribution whenever you have it, and label any number from this curve as an estimate.
- The curve describes concentration, not causation. The top inputs may depend on the rest (prerequisites, safeguards, maintenance).
- Small samples and noisy measures make the head look more concentrated than it is.
- Do not recurse more than the data supports; each level multiplies the error.

Deliver the requested work, not a compulsory process report. State material assumptions and the evidence that would change the recommendation. Stop when the goal is met or an explicit budget/authority boundary is reached.
