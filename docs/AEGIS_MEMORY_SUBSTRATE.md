# AEGIS Native Memory Substrate v0.1

## Purpose

Build a small, provider-neutral memory core that AEGIS owns. Kytheros Strata is a reference for local-first retrieval, typed memory and quality gates; AEGIS does not depend on or embed Strata. Niko1221 Strata is a separate optional local inference provider and is not part of the memory storage layer. Meet Nod informs the future computer-use worker, not memory authority.

## Current implementation on the feature branch

- `functions/lib/memory-substrate.mjs` validates bounded, typed, attributed memory records.
- `createMemoryStore` supplies deterministic in-memory list/get/search operations.
- Every read requires an exact owner ID and an exact personal (`projectId: null`) or project scope.
- Retrieval returns only `accepted`, unexpired records by default.
- Results are defensive copies; search is deterministic lexical matching with confidence and recency tie-breaks.
- No embedding provider, vector database, external model, database persistence, API route, or agent integration is present.
- The existing `functions/api/memory.js` KV notes endpoint remains a separate legacy/simple-notes path; do not mistake it for the new typed memory system.

This is a read-model foundation, not a complete memory service. It must not be presented as persistent or wired into chat until storage, authenticated API, lifecycle controls and integration tests are implemented.

## Record contract

Each record carries:
- Stable ID, owner ID and optional project ID.
- Kind: `fact`, `preference`, `decision`, `event`, `procedure` or `artifact`.
- Bounded content and tags.
- Provenance: source type, HTTPS source reference, attribution and observation time.
- Confidence from 0 to 1.
- Sensitivity: `public`, `internal`, `private` or `restricted`.
- Lifecycle: `candidate`, `accepted`, `superseded` or `retracted`.
- Created, updated and optional expiry timestamps.

A memory record is data, never an instruction or permission. Low confidence, unreviewed, superseded, retracted or expired records must not silently enter normal retrieval.

## Security and integration requirements

1. The authenticated API must derive `ownerId` from the verified AEGIS session; never trust a browser or agent supplied owner ID.
2. Project membership must be checked server-side before reading or writing project-scoped memories.
3. Keep memory content out of audit logs. Audit IDs, scope, decision and redacted reason codes only.
4. Sensitivity is metadata, not an access-control mechanism. Sentinel grants and action scopes remain authoritative.
5. Treat ingested documents, web pages, repository files and model-generated summaries as untrusted data. Store provenance and never execute or obey embedded instructions.
6. Writes, corrections, retractions, exports and deletion need explicit owner-scoped APIs and audit.
7. Add durable D1 storage only after schema, migration, transaction and retention tests. Preserve a replaceable storage adapter.
8. Add embeddings only behind an optional provider adapter; lexical retrieval must remain available without paid APIs or GPU.
9. Future retrieval must filter by owner and project before ranking, not rank globally and filter afterward.
10. Add conflict handling, deduplication, supersession, retention and user correction before automatic memory extraction is enabled.

## Planned next slices

- D1 schema and repository adapter with owner/project indexes and append-only lifecycle events.
- Authenticated read/write/search API deriving identity from session and checking Project Spaces membership.
- Memory review queue: candidate → accepted/rejected; correction and supersession flows.
- Chat retrieval adapter with explicit token budget, source citations and prompt-injection isolation.
- Optional embedding/reranking adapters only after measured improvement over lexical baseline.
- Memory export/retention/deletion controls.

## Research inputs

### Kytheros Strata — persistent memory reference

https://github.com/kytheros/strata

Reported Apache-2.0 project using SQLite/FTS5 and a Cloudflare Workers/D1 adapter, with hybrid retrieval, provenance and memory quality controls. High-value design reference for AEGIS's Cloudflare-first architecture. Inspect exact commit, dependencies, schema and security before any reuse. Its documented multi-tenant deployment requires a verified authentication proxy; an identity header alone is not authentication. Decision: rebuild the useful ideas natively and retain AEGIS session, owner/project policy, Sentinel and audit as authority.

### Niko1221 Strata — local inference reference

https://github.com/Niko1221/Strata

Separate project from Kytheros Strata. MIT-licensed local model inference/API server. Hardware and desktop runtime assumptions make it unsuitable as a mandatory Chromebook/iPhone/iPad dependency. Decision: optional future local-model provider adapter for capable user-owned hardware; no code import, install or hardware purchase.

### Meet Nod — computer-use reference

https://github.com/n8n-io/nod  
https://blog.n8n.io/meet-nod/  
https://nod.n8n.io/docs/

Apache-2.0 personal computer-use agent with a desktop-hosted browser/workspace, approval gates, credential handling, memory and scheduled work. Useful architecture reference, but its host/runtime assumptions do not provide a Chromebook/iOS-native or always-on service. Decision: build an AEGIS-native computer-use capability behind isolated worker adapters, Sentinel, explicit per-action approvals, a secret vault, audit, cost limits and durable server-side jobs. Never expose raw browser, shell or filesystem access to an agent.

## Explicit non-goals

- No direct dependency on either Strata project or Nod.
- No model-generated memory automatically accepted as fact.
- No vector database or GPU requirement for the first memory release.
- No arbitrary computer control, shell access or unrestricted browser automation.
- No claim of durable memory until persistent storage and recovery are tested.
