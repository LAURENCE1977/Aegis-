# AEGIS Learning Forge

**Status:** Immutable learning-path registry and prerequisite-gated self-reported progress implemented on draft PR #103; full CI for the progress slice is pending.

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
