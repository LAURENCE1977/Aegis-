# AEGIS Eval Forge

**Status:** First deterministic scoring contract implemented on draft PR #103. The contract is not yet connected to a persisted suite catalogue, evaluation execution worker, user interface or promotion API. CI verification is pending for the current implementation commit.

## Purpose

Eval Forge is the AEGIS-owned evaluation and release-evidence layer. It turns the DSPy, Guidance, Braintrust and agent-harness research into a portable contract without making any of those products a mandatory dependency.

It must answer four separate questions:

1. What exact versioned suite and cases were used?
2. Which exact candidate artifact was evaluated?
3. What evidence-backed outcome did each case produce?
4. Is the result eligible for human review, without granting permission to promote?

Evaluation quality is not the same as policy authority. Sentinel remains the only permission authority; an evaluation score can never grant a capability, approve a deployment or authorise a tool.

## Implemented contract

`functions/lib/eval-forge.mjs` currently provides:

- `validateEvaluationSuite(suite)`: strict allowlist, semantic version, task type, 1–200 unique cases, bounded positive integer weights, required-case flags and a 10,000 total-weight ceiling.
- `scoreEvaluationRun(suite, run)`: exact candidate version and SHA-256 digest, canonical UTC completion timestamp, one result per suite case, result evidence digests, bounded durations and deterministic weighted scoring.
- A required case must pass regardless of the aggregate score. Skipped cases earn no weight.
- Results are normalised into suite order; required failures are sorted for stable comparison.
- The returned score is immutable and contains digests and case outcomes, not raw prompts, model responses, files or user content.

The first test-first contract suite is in `tests/eval-forge.test.mjs`.

## Trust and security boundaries

- A digest identifies bytes; it does not prove who produced them or that an evaluation harness was honest.
- The current scorer validates structure and computes a score. It does not execute tests, verify evidence bytes, authenticate a runner or establish candidate safety.
- A future server-side runner must bind results to a trusted execution receipt, pinned suite revision, candidate artifact digest, isolated worker identity and immutable run lineage.
- Model-generated self-assessments are not accepted as trusted evaluation results. Checks need deterministic assertions or an independently governed evaluator with explicit limitations.
- Evaluation datasets must be versioned, attributable and checked for contamination/leakage. Hold-out sets must not be used for tuning.
- Candidate promotion remains a separate action requiring fresh Sentinel authorisation, human approval where policy requires it, a known-good rollback target and an auditable decision. No automatic promotion exists.

## Next implementation sequence

1. Verify the deterministic contract with the full Node.js and isolated D1 CI workflow.
2. Add owner-scoped, immutable D1 suite versions and evaluation-run history with append-only events.
3. Add authenticated, same-origin read/create APIs with strict bounds and optimistic concurrency where mutable drafts are involved.
4. Add a read-only owner UI for suites, runs, case evidence digests, score breakdown and regression comparison.
5. Add a separately isolated execution adapter for deterministic tests; no shell or network by default.
6. Add a promotion review record that can only request human/Sentinel review, never promote by score alone.

## Explicitly not implemented

No model-as-judge, DSPy optimiser, external Braintrust service, automatic training, live user experimentation, online reinforcement learning, arbitrary code runner, scanner, model deployment or production promotion is enabled.
