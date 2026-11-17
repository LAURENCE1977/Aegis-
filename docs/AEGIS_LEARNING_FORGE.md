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
