# AEGIS Learning Forge

**Status:** Immutable, owner-scoped learning-path registry implemented and full CI verified on draft PR #103 (17 November 2026).

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
