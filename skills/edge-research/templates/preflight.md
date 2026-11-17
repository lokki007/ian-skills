# Preflight — <run name>

Frozen before row 0 is written. If any item below changes, start a new generation.

## 1. Objective
<one sentence: what should improve>

## 2. Target
<exact files/components allowed to change>

## 3. Mode
<one routed specialist: strategy | code | system | performance | harvest>

## 4. Frozen harness
- Inputs:
- Requirements:
- Evaluator:
- Weights:
- Blocking gates:

## 5. Metric vector
- Blocking correctness/safety:
- Primary quality:
- Worst-case regression:
- Performance/cost:
- Simplicity:

## 6. Development cases (exactly 5 unless deterministic benchmark)
1. <case id>: <one-line scenario>
2. <case id>: <one-line scenario>
3. <case id>: <one-line scenario>
4. <case id>: <one-line scenario>
5. <case id>: <one-line scenario>

## 7. Holdout
<at least one unseen or adversarial case, evaluated only at baseline and finalist>

## 8. Budget / stopping rule
- Default: 10 chat experiments, 25 background, plus no-improvement cutoff.
- This run:

## 9. Baseline provenance
- `current-real` | `historical` | `synthetic-negative-control`
- Hash:
- Timestamp:

## 10. Evidence plan
- Static | Deterministic | Runtime | Live-provider | Real-user
- Per-claim tier required: