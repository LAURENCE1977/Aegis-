# Guardian Intelligence Contracts and Resource Catalogue

**Status:** Resource validation, owner-scoped D1 persistence, authenticated read/create API and guarded review lifecycle implemented on the stacked draft PR #103. Learning Graph and Security Finding remain pure validation contracts. No catalogue UI, scanner, active test runner or security-worker execution is implemented.

## Purpose

Build the Resource Intelligence, Learning & Mastery and Governed Security Research foundations without creating a second permission authority. These contracts reject malformed or unexpected data; they do not confer trust, prove a source safe, authorise a scan or replace Sentinel.

## 1. Resource records

`validateResourceRecord(record)` validates:
- canonical HTTPS source identity and source revision;
- explicit category and licence review state;
- HTTPS licence evidence when the licence is marked verified;
- pricing model, evidence URL and ISO timestamp;
- explicit limits for free-tier and trial claims;
- hosting mode, operational requirements and limitations;
- strict field allowlists and bounded text arrays.

A `verified` licence state is a structured owner-review assertion backed by a reference, not legal advice or an automated compatibility decision. Pricing is time-bound evidence, not a promise that a provider's offer remains available.

## 2. Resource Catalogue persistence and API

Implemented:
- `migrations/forge/0006_guardian_resources.sql` creates `guardian_resources` with JSON validity checks and unique owner/canonical-URL/source-revision identity.
- `guardian_resource_events` records creation lineage; update and delete triggers make the event table append-only.
- `functions/lib/guardian-catalogue.mjs` provides owner-scoped, idempotent create and bounded list operations. IDs are generated server-side; new resources always start as `draft`.
- `GET /api/guardian/resources` lists only the authenticated owner's resources.
- `POST /api/guardian/resources` requires an owner session, same-origin request, bounded JSON body and server-generated identity. Unknown fields and client-supplied IDs are rejected.
- Duplicate owner + canonical URL + source revision submissions return the existing resource rather than creating a second record.

Review lifecycle is implemented by `migrations/forge/0007_guardian_resource_review.sql` and `PATCH /api/guardian/resources/:id`. Allowed transitions are draft → reviewed → accepted and draft/reviewed/accepted → archived; archived is terminal. Every transition requires a non-empty bounded reviewer note, server-derived reviewer identity and a strictly advancing timestamp. The expected prior `updatedAt` is required to prevent stale writes. The D1 guard makes source content and identity immutable, prevents review-metadata edits outside a status transition, checks the transition graph and requires verified licence status plus HTTPS evidence before acceptance. A trigger appends a review event with from/to status, reviewer and note. These checks are repeated in application code and database constraints/triggers.

## 3. Learning graphs

`validateLearningGraph(nodes)` validates:
- unique stable node identifiers;
- bounded outcomes, difficulty and attributable HTTPS source references;
- explicit content-licence status;
- existing prerequisites and no self-dependencies;
- acyclic prerequisite graph.

The graph stores links and learning metadata, not copied course content. This validator does not infer learner mastery or redistribute third-party materials. Persistence, progress history and user-facing learning workflows remain future work.

## 4. Security findings

`validateSecurityFinding(finding)` validates:
- exact owner/resource identity and a SHA-256 scope digest;
- enumerated severity, confidence, status and assessment method;
- bounded evidence references with digests rather than raw tool output;
- timestamps, summary and optional remediation guidance;
- dynamic-test grant/approval identifiers bound to the same scope digest.

**Critical boundary:** this is structural validation only. A caller cannot make an assessment authorised by supplying `grantId` and `approvalId`. Before any dynamic test, a future server-side route must load the persisted target and scope, obtain grant/approval state from Sentinel's trusted server context, revalidate expiry/revocation/rate limits, and create an immutable audit receipt. Browser-supplied lineage fields must be rejected. No dynamic test execution exists.

## 5. Test and verification evidence

- Contract test RED: workflow `44127001100` failed because the validation module did not yet exist; 721 existing tests passed and one was skipped.
- Resource persistence/API RED: workflow `44127986972` failed because the catalogue module, API route and migration did not yet exist.
- Resource fixture correction: the first implementation run exposed a test-double binding mismatch (the literal SQL default `'draft'` is not a bound parameter). The fake D1 fixtures were corrected; production SQL was not weakened to accommodate the test double.
- GREEN/full CI: workflow `44128806884` passed on head `eda95b240b19392a12e42c74d7546f805120cbd9`: 745 tests, 744 passed, zero failed, one skipped. Node.js tests, isolated capability/runtime/Queue Miniflare and Forge D1 migrations passed.
- The Forge D1 CI step seeds a Guardian Resource and verifies draft status, exactly one creation event, and that event update/delete operations are rejected.

These checks do not establish production D1 migration, production deployment, legal approval, security certification or full upstream source audit.

## 6. Next gates

1. Add resource detail/events endpoints and a simple owner-facing catalogue UI.
2. Persist learning graphs with owner scoping, versioning and append-only history; add mastery/progress only with user-visible controls.
3. Add property-based/adversarial tests for URL parsing, graph size/depth, stale evidence and malformed findings.
4. Add Security Research capability declarations only after exact target registration, Sentinel policy, isolated-worker enforcement, egress/resource controls, cancellation and effect-level audit verification exist.
5. Keep active scanning disabled; no ambient shell, Docker socket, arbitrary network egress, C2, persistence or autonomous remediation.

## 7. Related research

See [the 17 November REA batch](REA_BATCH_2026-11-17_OPEN_SOURCE_LEARNING_SECURITY.md) for Free-for-dev, OSSU, Awesome Selfhosted, ARTEX, Cairn, PentAGI, PentestGPT, Strix and CyberStrikeAI candidate assessments.
