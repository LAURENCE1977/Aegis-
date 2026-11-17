# AEGIS Learning Forge

**Status:** Immutable learning-path registry and prerequisite-gated self-reported progress implemented and full PR CI verified on draft PR #103 (17 November 2026).

## Contract

A learning path is a versioned graph:

- `id`, semantic `version`, `title` and bounded `description`;
- 1–500 learning nodes validated by `validateLearningGraph`;
- each node has a unique slug, outcomes, prerequisites, difficulty, attributable HTTPS source references and an explicit content-licence state;
- prerequisites must exist, cannot self-reference and must form an acyclic graph;
- external source material is linked and attributed; link-only status does not imply permission to copy or redistribute content.

## Persistence and API

- `migrations/forge/0010_learning_paths.sql` stores owner-scoped immutable graph versions with a unique owner/path/version key and SHA-256 graph digest.
- Registration emits one append-only event. Database triggers reject update/delete of graph versions and audit events.
- `functions/lib/learning-forge.mjs` canonicalises JSON independent of key order, validates the graph, registers idempotently and rejects different content under an existing version.
- Authenticated same-origin `POST /api/learning/paths` registers a path; authenticated `GET /api/learning/paths` lists owner-scoped paths with bounded page size.
- Owner identity is server-derived. Caller-supplied owner fields and unknown graph/node fields are rejected.

## Not yet implemented

This slice is a catalogue and graph registry, not a complete adaptive tutor or mastery engine. It does not yet persist node progress, practice attempts, mastery evidence, spaced-repetition schedules, learning recommendations or adaptive sequencing. It does not ingest or copy course content, scrape source sites, assess user skill automatically or send learning data to external providers.

The next slice should add owner-scoped progress events, prerequisite-gated transitions, explicit learner corrections and evidence-backed mastery without turning time-on-task or completion clicks into proof of mastery.


## Learner progress and prerequisite gates

A second slice adds owner-scoped learner progress:

- `migrations/forge/0011_learning_progress.sql` stores node state against an exact immutable path version and appends progress events. Progress rows cannot be deleted; events cannot be updated or deleted.
- The state labels are deliberately modest: `in_progress` and `self_reported_complete`. A completion click is not proof of learning; every response explicitly reports `masteryVerified: false`.
- `functions/lib/learning-progress.mjs` enforces optimistic concurrency, allowed transitions, exact path/node identity and prerequisite completion before a learner can start or self-report completion of a downstream node.
- D1 triggers independently enforce the prerequisite rule on insert and update, preventing direct database writes from bypassing the graph gate.
- Authenticated `GET/PATCH /api/learning/paths/:id/progress` lists and records progress with same-origin write protection and bounded request bodies.
- No assessment engine, mastery certification, spaced-repetition scheduler or automatic skill inference is enabled.


## Deterministic assessment contract — first slice (17 November 2026)

**Status:** Pure assessment validation and scoring contract implemented; CI verification pending.

- Added `functions/lib/learning-mastery.mjs` with immutable-shape, semantic-version-bound assessment validation.
- Assessments bind to an exact Learning Path version and node, contain 1–50 uniquely identified questions, bounded point weights and a 1–100% pass threshold.
- The scorer requires exactly one bounded answer for every question, rejects missing/extra/malformed answers, and calculates a deterministic weighted percentage.
- The result includes the exact assessment/path/node identity and earned/possible points. It explicitly returns `masteryVerified: false`: pure scoring is not yet a persisted, authenticated mastery record.
- Correct answers are part of the trusted assessment definition and must not be exposed by a future learner-facing assessment-delivery API.
- This slice does not yet persist assessments or attempts, provide a learner UI, enforce retry/cooldown rules, or issue verified mastery. Those require immutable assessment registration, server-side answer handling, append-only attempt evidence, and an independently tested mastery policy.
- No learning data is sent to an external model or provider; no model-as-judge is used.


## Learner-safe assessment delivery contract — second slice (17 November 2026)

**Status:** Pure validation, learner projection and deterministic scoring implemented; persistence and CI verification remain pending.

- Assessment questions now carry bounded prompts and exactly four unique answer options.
- `projectLearnerAssessment` creates an explicit allowlisted learner-facing projection. It omits the answer key and pass threshold rather than serialising the trusted assessment object directly.
- Scoring remains server-side and deterministic; malformed, missing and extra answers are rejected.
- Results continue to state `masteryVerified: false`. A passing score alone is not a durable mastery credential.
- The learner projection is a pure contract, not yet an HTTP endpoint. A future endpoint must load trusted registered assessment versions server-side and must never accept an assessment definition or answer key supplied by the learner.
- Still required: immutable assessment persistence, attempt-rate policy, append-only attempts, authenticated learner endpoints, assessment version revocation/supersession policy, and independent mastery verification.


### Learning assessment CI correction — weighted-score expectation (17 Nov 2026)
- The full test run exposed an incorrect test expectation, not a scoring defect: with weights 1, 1 and 2, answering only the second question correctly earns 25%, not 50%.
- Corrected the fixture to test a genuine 50% case (the two one-point questions correct) and added a separate 25% assertion.
- The failed run 44176407237 executed 815 tests: 813 passed, one failed, one skipped. D1/runtime steps were skipped because the Node.js step failed.
- Corrected test commit: 415d06067c0695a4351be7dd272d72825c4890a6. Fresh CI is pending; no pass is claimed.


## Immutable assessment registry — third slice (17 November 2026)

**Status:** Implementation committed to draft PR #103; CI verification pending.

- Migration `0012_learning_assessments.sql` stores immutable, owner-scoped assessment versions and append-only registration events, bound to the exact path version through a composite foreign key.
- The store validates the assessment, verifies the exact path version and node, hashes canonical assessment JSON, treats identical registration as idempotent and rejects content changes under an existing version.
- Authenticated same-origin `GET/POST /api/learning/assessments` is bounded and owner-scoped. POST returns metadata only; GET returns `projectLearnerAssessment` projections, not trusted assessment definitions.
- The learner projection excludes `correctOption` and `passPercent`. Trusted answer keys remain in the server-side assessment record and must never be returned to learner clients.
- Database triggers prevent update/delete of assessment versions and audit events.
- Tests cover exact path/node binding, idempotency, immutable conflicts, owner isolation, page limits and answer-key/pass-threshold omission.

This still does not implement learner attempt submission, retry/cooldown policy, append-only attempt history, revocation/supersession, or mastery certification. A score remains learning evidence only; it cannot confer permissions or authority. CI and D1 runtime verification are pending.


## Server-scored attempts and explainable next actions — fourth slice (17 November 2026)

**Status:** Implemented on draft PR #103. Latest push and D1 migration/smoke verification passed.

### Immutable attempt history

- Added `migrations/forge/0013_learning_assessment_attempts.sql` with owner-scoped attempts bound by foreign key and database trigger to an exact registered assessment version and its path/node identity.
- Attempts persist the deterministic score, pass/fail result, assessment digest and timestamp. **Raw answers are not stored, and no hash of the low-entropy multiple-choice answers is stored either.**
- The API accepts only assessment ID/version and answers. It never accepts a client score, pass flag, owner ID or mastery claim.
- Scoring loads the trusted immutable assessment server-side and rejects missing, extra or malformed answers.
- D1 enforces a 30-second cooldown and a maximum of five attempts per assessment version in a rolling 15-minute window. This is enforced at the database write boundary, not just in application code.
- Attempt records and submission events are append-only and reject update/delete. Attempt history is private, owner-scoped and bounded.
- Every result explicitly reports `masteryVerified: false`. Passing an assessment does not issue a credential, alter progress or grant capability/agent authority.

### Adaptive next-action engine

- Added `functions/lib/learning-recommendations.mjs`, a deterministic, local, explainable recommendation function.
- It considers only the exact path revision, validates progress and attempt projections, and honours prerequisite completion.
- It prioritises review after a failed check, reinforcement after a pass, continuation of an in-progress node, and starting the next eligible node.
- Each recommendation includes a plain-language reason, source references, deterministic priority and timestamp.
- Attempts from another path revision are ignored; malformed evidence is rejected rather than guessed.
- Recommendations never change progress or certify mastery. This is a pure engine; a persisted recommendation feed/UI and spaced-repetition scheduler are not yet implemented.

### Verification

- GitHub Actions run `44183737666` passed on code head `f50b4bfd9b4faf149cddedd3385bf9d31abe577a`: **838 tests, 837 passed, 0 failed, 1 skipped**, plus all isolated D1 migration/runtime/Forge checks.
- Follow-up run `44184401063` passed on `8d52871d98768334df4de350731b9728de424714`: **844 tests, 843 passed, 0 failed, 1 skipped**, plus isolated D1 migration/runtime/Forge checks.
- The first run exposed an SQL column-order syntax defect in migration `0012`; the column definition was moved ahead of table constraints and the subsequent complete migration/smoke run passed.
- The new attempt-history migration, assessment and attempt integrity checks, invalid-node rejection, append-only triggers and rapid-retry cooldown were exercised by the Forge D1 CI smoke workflow.

Still not implemented: learner-facing identity/accounts beyond the existing owner-auth boundary, a learner UI, independent mastery certification, attempt retention/deletion policy, recommendation persistence, spaced repetition and a supervised tutor conversation. The current owner API is the existing single-owner pattern; it is not presented as a multi-tenant learner platform.


## Independent mastery evidence — candidate policy (17 November 2026)

**Status:** Pure deterministic policy added; CI is running. This is not a mastery certificate or an active learner-facing workflow.

- Added `functions/lib/learning-mastery-evidence.mjs` and `tests/learning-mastery-evidence.test.mjs`.
- A candidate requires at least two distinct passed assessment attempts on separate UTC dates, an applied-task artifact identified by SHA-256 digest, and an approving human review that explicitly references every qualifying evidence record.
- Every record is bound to the exact immutable path version and node. Duplicate evidence identifiers, malformed identities, future timestamps, cross-version evidence and unsupported evidence kinds are rejected.
- A single assessment pass, repeated attempts on one day, a missing applied task, incomplete review references or AI-only review cannot produce a candidate.
- The output is `candidate_for_human_confirmation` with `masteryVerified: false`; insufficient evidence returns explicit missing-evidence reasons. No capability, autonomy, credential or permission follows.
- **Trust boundary:** this pure policy validates structure and relationships, not the truth or provenance of the evidence. Before production use, a trusted service must load attempt records and artifact-review records from their authoritative stores, authenticate reviewer identity and independence, and bind artifact digests to retained or independently verifiable evidence. Caller-supplied JSON must never be treated as authoritative.
- No learner identity expansion, automatic certification, AI-as-reviewer, public API or UI is introduced.

### Next controls

1. Add authoritative evidence loading and reviewer independence checks before exposing candidate generation.
2. Decide a privacy-preserving attempt retention/deletion policy; the current append-only attempt store needs a governed retention design rather than an unreviewed delete path.
3. Add spaced repetition only after user-controlled scheduling and notification consent are designed.
4. Resolve learner identity and tenancy before building a multi-user UI.
