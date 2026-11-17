# Behavioral regression and selective mutation checks

Use with the project's existing testing rules, not instead of them.
Reuse the project's tests, helpers, stdlib and installed tools; add no framework
or abstraction just for this guidance. Keep the implementation small.

## Prove the regression

- Trace the affected flow and callers. For a bug, add or update the smallest
  meaningful behavioral regression in the existing test system **before fixing**
  production code. Assert the observable contract, not implementation trivia.
- Run that focused check on the unfixed code. Observe failure for the expected
  buggy behavior. Import/setup errors, missing dependencies, network failures,
  and broken infrastructure are not a verified RED.
- Make the smallest root-cause fix, then rerun the same check and observe GREEN.
  Cover changed non-trivial behavior proportionately. If RED cannot be verified,
  say why, record the alternate evidence and remaining uncertainty; never claim
  a demonstrated red-to-green transition without observing both runs.
- Retain required broader lint, test, build, security, review and release gates.
  Focused checks supplement them; they never waive them.

## Mutation checks are selective, not a routine gate

Consider a bounded check when changed deterministic logic has material risk:
finance calculations, authorization/security decisions, parsers or validators.
Skip low-value cases and explain a material skip; do not run a whole-repo campaign.

- Establish a passing focused baseline for the exact candidate code. Use only
  an existing, installed, platform-supported mutation tool, scoped to the changed
  functions/lines and relevant tests. Never install dependencies automatically.
- Set the budget before running: **one worker, at most 10 mutants, five minutes
  total and 60 seconds per test run**, stopping at the first limit. Honor stricter
  project/user limits; do not expand scope or budget silently.
- If no suitable tool exists, optionally try 1-3 isolated manual boundary/operator
  changes **only in a safe disposable worktree** with the exact candidate code
  and a passing baseline. Preserve all user changes; never stash, reset, commit
  or overwrite the working tree to arrange this. If safe isolation or faithful
  reproduction is unavailable, skip with a reason. No improvised runner/framework.
- Record which behavior each mutation probes. A timeout, setup error or invalid
  mutant is not a meaningful behavioral kill. Analyze survivors: missing assertion,
  equivalent behavior, unreachable path or unclear contract. Add only valuable
  coverage; do not chase 100% mutation scores.
- Revert every injected mutation, including after failure/interruption. Compare
  source hashes and diffs against the recorded pre-mutation candidate baseline,
  then rerun focused tests. Verify no mutation residue; expected task edits and
  pre-existing user changes must remain intact. Stop and report unexpected edits
  rather than overwriting them. Do not report completion until restoration is
  verified, or clearly report the unresolved residue and exact location.

Report actual checks, RED/GREEN evidence or limitation, mutation scope/results
or skip reason, budget and restoration verification. These rules authorize no
automatic commit, push, dependency install, destructive cleanup or worktree deletion.
