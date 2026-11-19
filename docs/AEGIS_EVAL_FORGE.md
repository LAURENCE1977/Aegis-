# AEGIS Eval Forge

**Status:** Deterministic scoring, byte-integrity verification, immutable suite registry, immutable run history and read-only owner APIs implemented on draft PR #103. No authenticated runner, execution worker, full evaluation UI or promotion API exists yet.

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

## Verification

Latest full CI passed on code head `7171d1baface0e4fabcecbe2df5bbad0e64b9be9`: push workflow `44156202471` and matching PR workflow `44156218085`. Node.js/Cloudflare runtime tests, capability/runtime/Forge D1 migrations, Queue integration, Guardian catalogue checks, Eval Forge suite registry smoke checks and Eval Forge run-history integrity smoke checks all passed. An earlier CI attempt exposed a SQLite table-constraint ordering error in migration `0009_eval_runs.sql`; the migration was corrected and the full workflow rerun successfully.

## Next implementation sequence

1. Add owner-scoped, immutable D1 suite versions and evaluation-run history with append-only events.
2. Add authenticated, same-origin read/create APIs with strict bounds and optimistic concurrency where mutable drafts are involved.
3. Add a read-only owner UI for suites, runs, case evidence digests, score breakdown and regression comparison.
4. Add a separately isolated execution adapter for deterministic tests; no shell or network by default.
5. Add a promotion review record that can only request human/Sentinel review, never promote by score alone.



## Immutable suite registry — implementation slice

Added on draft PR #103 and verified by full CI on 17 November 2026:

- `migrations/forge/0008_eval_suites.sql` creates owner-scoped immutable suite versions with a unique owner/suite/version key, canonical content digest, JSON validity constraint and append-only registration event.
- Database triggers reject suite update/delete and event update/delete. A suite version is a permanent revision; changing its content requires a new semantic version.
- `functions/lib/eval-forge-store.mjs` validates suites before persistence, canonicalises JSON independent of object-key order, computes SHA-256, supports idempotent registration and rejects attempts to reuse a version with different content.
- `functions/api/eval/suites.js` exposes authenticated, same-origin POST and authenticated GET with bounded JSON bodies and page size. Owner identity is server-derived; caller-supplied owner fields are rejected by the suite contract.
- Tests cover immutable version registration, canonical digest stability, idempotency, conflicting content, owner isolation, authentication, cross-origin writes, invalid payloads and repeated query parameters.
- CI applies the new Forge migration and smoke-tests unique version keys, immutable suites and append-only audit events.

**Boundary:** Suite definitions and byte-integrity-checked run results are persisted, but no raw prompts/evidence bytes are stored. The system does not execute candidates, authenticate a runner or approve promotion. A caller-supplied `evidenceVerified` flag is never trusted.



## Immutable evaluation-run history — implementation slice

Added alongside the suite registry:

- `migrations/forge/0009_eval_runs.sql` stores owner-scoped run results linked by foreign key to an exact registered suite version. Run IDs are unique per owner; result status, score and digest fields are constrained.
- Database triggers append one registration event per run and reject update/delete of run results and audit events.
- `functions/lib/eval-forge-runs.mjs` requires the exact registered suite version and matching canonical suite digest, then calls the byte verifier before persisting a result.
- Only the deterministic score/result and evidence digests are stored; candidate/evidence bytes and raw prompts are not persisted.
- Duplicate identical run IDs are idempotent; reusing a run ID for a different result returns a conflict.
- Owner-scoped run listing is bounded. No public route accepts caller-supplied `evidenceVerified`; the run persistence module derives that marker only after byte verification.

**Important trust limitation:** A digest proves byte equality, not runner identity or truthful execution. There is no authenticated isolated runner or attestation receipt, and no public run-submission endpoint. Do not treat a stored result as a production safety certification or promotion authorisation.

## Explicitly not implemented

No model-as-judge, DSPy optimiser, external Braintrust service, automatic training, live user experimentation, online reinforcement learning, arbitrary code runner, scanner, model deployment or production promotion is enabled.


### Read-only run history API

- Added authenticated `GET /api/eval/runs` with owner scoping and bounded page size.
- It exposes persisted result summaries for inspection only; there is deliberately no public run-creation endpoint until AEGIS has an authenticated isolated runner and trustworthy execution receipts.
- The database now binds key result JSON fields (run ID, suite revision, candidate identity/digest, status and score) to their indexed columns and requires the evidence-integrity marker. The reader also rejects rows missing that marker.
