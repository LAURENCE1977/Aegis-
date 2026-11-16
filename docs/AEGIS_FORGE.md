# AEGIS Forge — safe repository inspection

## Purpose

Forge is AEGIS's source-aware reverse-engineering workshop. It inspects public GitHub repositories and reads selected source files by immutable Git blob SHA. It does not install, build, run, import or execute inspected code.

## API

- `POST /api/forge/inspect`: owner-authenticated, same-origin JSON request containing one canonical public GitHub repository URL. Returns repository metadata, the default branch tree SHA, a bounded list of inspectable file paths/blob SHAs/sizes and a truncation indicator.
- `POST /api/forge/read`: owner-authenticated, same-origin JSON request containing the repository URL and a pinned blob SHA. Returns the bounded UTF-8 text content for that blob.

## Safety controls

- Only HTTPS `github.com` repository URLs are accepted; private repositories are rejected.
- All outbound requests use the fixed `https://api.github.com` origin, reject redirects and use a 15-second timeout.
- GitHub JSON responses are bounded to 4 MiB.
- Inspection returns at most 100 selected text files, each no larger than 32 KiB.
- Common vendored/build directories, minified bundles, source maps and binary/non-UTF-8 blobs are excluded.
- Blob reads are pinned by SHA, repository-scoped, size-checked and decoded with fatal UTF-8.
- Request bodies are streamed and bounded before any GitHub request.
- Retrieved repository content is untrusted data. It is never executed, treated as instructions or granted permissions.

## Current limitations

This slice does not persist candidates, perform licence review, scan dependencies/advisories, create build artifacts or run tests against upstream repositories. Those are separate Forge stages. No external repository is installed or connected.


## Candidate review lifecycle

An inspected repository can be saved as an owner-scoped Forge candidate, pinned to the default-branch tree SHA. Candidate creation always starts with `decision: unassessed` and `licence.review: review-required`; GitHub's SPDX metadata is a hint, not legal clearance. The owner must attest to reviewing the actual licence text, provide an HTTPS evidence URL and a review note before choosing reuse/adapt/combine or marking a candidate approved. D1 triggers enforce the licence gate, immutable source identity and append-only candidate events. Candidate review does not install or execute the repository.


## Knowledge Library — persisted owner-reviewed records

AEGIS now has a separate owner-scoped Knowledge Library, distinct from the upstream repository candidate catalogue. It stores evidence-backed reusable knowledge records with a title, domain, knowledge type, summary, evidence level, source URLs/attribution, limitations and applicable AEGIS capabilities.

The lifecycle is deliberately human-gated:

`draft → reviewed → accepted → superseded`

- New records are always inserted as `draft`; clients cannot choose an initial status.
- The owner must add a review note and use the optimistic `expectedUpdatedAt` value to move a draft to `reviewed`.
- Only `high` and `medium` evidence can progress from `reviewed` to `accepted`. Low and experimental findings can be reviewed and retained, but are not eligible for acceptance.
- Accepted records can be superseded without deleting their history.
- Knowledge content, source attribution and limitations become immutable after review. A correction requires a new record.
- Every create/review/accept/supersede transition produces an append-only `forge_knowledge_events` entry. Database triggers enforce initial-draft-only creation, valid status transitions, content immutability and append-only history.
- Search defaults to `accepted` records only. Owner-only status filters can inspect drafts, reviewed and superseded records.
- Source count is capped at 20; limitations at 50; the API body at 96 KiB. Search results are bounded to 100 records.

Owner-only Pages API:
- `GET /api/forge/knowledge?q=...` — bounded search; defaults to accepted records.
- `GET /api/forge/knowledge?status=all` — inspect all owner records.
- `POST /api/forge/knowledge` — create a draft from supplied evidence and metadata.
- `GET /api/forge/knowledge/:id` — read one record.
- `PATCH /api/forge/knowledge/:id` — record an explicit review, acceptance or superseding decision.
- `GET /api/forge/knowledge/:id/events` — read append-only lifecycle history.

Migration: `migrations/forge/0003_knowledge_records.sql`.

The Knowledge Library is currently a persisted API-backed foundation. Its dedicated Forge UI and retrieval of accepted records into Agent Workforce context remain follow-on work. No external source is automatically trusted or ingested, and no record can trigger a tool or deployment.
