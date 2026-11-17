# AEGIS Eval Forge

**Status:** Deterministic scoring and byte-integrity verification foundations implemented on draft PR #103. No persisted suite catalogue, authenticated runner, execution worker, user interface or promotion API exists yet.

## Purpose

Eval Forge is the AEGIS-owned evaluation and release-evidence layer. It turns the DSPy, Guidance, Braintrust and agent-harness research into a portable contract without making any of those products a mandatory dependency.

It must answer four separate questions:

1. What exact versioned suite and cases were used?
2. Which exact candidate artifact was evaluated?
3. What evidence-backed outcome did each case produce?
4. Is the result eligible for human review, without granting permission to promote?

Evaluation quality is not the same as policy authority. Sentinel remains the only permission authority; an evaluation score can never grant a capability, approve a deployment or authorise a tool.

## Implemented contract

`functions/lib/eval-forge.mjs` provides:

- `validateEvaluationSuite(suite)`: strict allowlist, semantic version, task type, 1–200 unique cases, bounded positive integer weights, required-case flags and a 10,000 total-weight ceiling.
- `scoreEvaluationRun(suite, run)`: exact candidate version and SHA-256 digest, canonical UTC completion timestamp, one result per suite case, result evidence digests, bounded durations and deterministic weighted scoring.
- A required case must pass regardless of the aggregate score. Skipped cases earn no weight.
- Results are normalised into suite order; required failures are sorted for stable comparison.
- The returned score is immutable and contains digests and case outcomes, not raw prompts, model responses, files or user content.

`functions/lib/eval-evidence.mjs` adds:

- `verifyEvaluationRunEvidence(suite, run, input)`: verifies the supplied candidate artifact bytes against the declared SHA-256 digest and verifies each case's evidence bytes against its result digest before scoring.
- Strict byte-type checks, a 64 MiB candidate cap, 1 MiB per-evidence cap and 4 MiB aggregate evidence cap.
- Exact evidence-case matching: missing, extra or mismatched evidence payloads are rejected.
- Uses Web Crypto SHA-256, available in supported modern Node.js and Workers runtimes.
- Returns an immutable scored result marked `evidenceVerified: true` only after byte checks pass.

Tests are in `tests/eval-forge.test.mjs` and `tests/eval-evidence.test.mjs`.

## Trust and security boundaries

- Byte-digest verification proves that supplied bytes match declared digests; it does not prove who produced them or that an evaluation harness was honest.
- The new verifier is a pure integrity gate. It does not execute tests, authenticate a runner, verify the source or quality of evidence, or establish candidate safety.
- A future server-side runner must bind results to a trusted execution receipt, pinned suite revision, candidate artifact digest, isolated worker identity and immutable run lineage.
- Model-generated self-assessments are not accepted as trusted evaluation results. Checks need deterministic assertions or an independently governed evaluator with explicit limitations.
- Evaluation datasets must be versioned, attributable and checked for contamination/leakage. Hold-out sets must not be used for tuning.
- Candidate promotion remains a separate action requiring fresh Sentinel authorisation, human approval where policy requires it, a known-good rollback target and an auditable decision. No automatic promotion exists.

## Next implementation sequence

1. Run focused and full Node.js/isolated D1 CI for the byte-verification addition.
2. Add owner-scoped, immutable D1 suite versions and evaluation-run history with append-only events.
3. Add authenticated, same-origin read/create APIs with strict bounds and optimistic concurrency where mutable drafts are involved.
4. Add a read-only owner UI for suites, runs, case evidence digests, score breakdown and regression comparison.
5. Add a separately isolated execution adapter for deterministic tests; no shell or network by default.
6. Add a promotion review record that can only request human/Sentinel review, never promote by score alone.

## Explicitly not implemented

No model-as-judge, DSPy optimiser, external Braintrust service, automatic training, live user experimentation, online reinforcement learning, arbitrary code runner, scanner, model deployment or production promotion is enabled.
