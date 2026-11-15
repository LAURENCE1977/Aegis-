# AEGIS Native Memory Substrate v0.2

## Purpose

Build a provider-neutral memory system that AEGIS owns. Kytheros Strata is a reference for local-first retrieval, typed memory and quality gates; AEGIS does not depend on or embed Strata. Niko1221 Strata is a separate optional local inference provider and is not part of memory storage. Meet Nod informs the future computer-use worker, not memory authority.

## Implemented on this feature branch

- `functions/lib/memory-substrate.mjs` validates bounded, typed, attributed memory records.
- `createMemoryStore` provides deterministic in-memory list/get/search for unit-level use.
- `createMemoryRepository` persists records in Cloudflare D1 and provides owner/project-scoped get/list/search and lifecycle transitions.
- `migrations/memory/0001_memories.sql` creates the D1 table and owner/scope/status/expiry indexes.
- `functions/api/memories.js` provides authenticated list/search and candidate creation.
- `functions/api/memories/[id].js` provides authenticated detail and review/lifecycle transitions.
- New records are always stored as `candidate`; normal list/search only returns accepted, unexpired records.
- The API derives the single deployment owner ID server-side and never accepts owner identity from request JSON.
- Project-scoped records require an existing active Project Space owned by the same deployment owner.
- Search is bounded lexical search; no embeddings, paid APIs or GPU required.
- Writes require a same-origin request; reads require the existing signed AEGIS session.

## Important deployment limitation

This branch adds the migration and code only. It does **not** provision D1, apply the migration to a live database, change Cloudflare bindings, or deploy the Worker/Pages app. The existing AEGIS D1 binding contract is `AEGIS_DB`; the actual database has not yet been provisioned. The legacy `/api/memory` KV notes endpoint remains separate and unchanged.

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

A memory record is data, never an instruction or permission. Unreviewed, superseded, retracted or expired records must not silently enter normal retrieval.

## Security and integration requirements

1. The authenticated API derives owner identity from the verified AEGIS session; never trust a browser or agent supplied owner ID.
2. Project membership is checked server-side before reading or writing project-scoped memories.
3. Memory content must not be copied into general audit logs. Future audit should record IDs, scope, decision and redacted reason codes only.
4. Sensitivity is metadata, not an access-control mechanism. Sentinel grants and action scopes remain authoritative.
5. Treat ingested documents, web pages, repository files and model-generated summaries as untrusted data. Store provenance and never execute or obey embedded instructions.
6. Lifecycle transition history, correction/supersession provenance, retention, export and deletion controls remain to be implemented.
7. D1 migration must be applied and tested before enabling the API in production.
8. Embeddings/reranking may be optional adapters only after measured improvement over the lexical baseline.
9. Retrieval filters by owner and exact project scope in SQL before ranking.
10. Automatic memory extraction must remain review-gated until conflict handling, deduplication and correction are implemented.

## Next implementation slices

- Append-only memory lifecycle audit table and atomic create/review transactions.
- Authenticated correction, supersession, retention, export and deletion controls.
- Connect chat retrieval with explicit token budget, source citations and prompt-injection isolation.
- Add memory UI: candidate review queue, accepted memories, source/provenance and correction.
- Only then benchmark optional embeddings/reranking against lexical retrieval.

## Research inputs

### Kytheros Strata — persistent memory reference

https://github.com/kytheros/strata

Reported Apache-2.0 project using SQLite/FTS5 and a Cloudflare Workers/D1 adapter, with hybrid retrieval, provenance and memory quality controls. High-value design reference for AEGIS's Cloudflare-first architecture. Inspect exact commit, dependencies, schema and security before any reuse. Its documented multi-tenant deployment requires a verified authentication proxy; an identity header alone is not authentication. Decision: rebuild useful ideas natively and retain AEGIS session, owner/project policy, Sentinel and audit as authority.

### Niko1221 Strata — local inference reference

https://github.com/Niko1221/Strata

Separate project from Kytheros Strata. MIT-licensed local model inference/API server. Hardware and desktop runtime assumptions make it unsuitable as a mandatory Chromebook/iPhone/iPad dependency. Decision: optional future local-model provider adapter for capable hardware; no code import, install or hardware purchase.

### Meet Nod — computer-use reference

https://github.com/n8n-io/nod  
https://blog.n8n.io/meet-nod/  
https://nod.n8n.io/docs/

Apache-2.0 personal computer-use agent with a desktop-hosted browser/workspace, approval gates, credential handling, memory and scheduled work. Useful architecture reference, but its host/runtime assumptions do not provide a Chromebook/iOS-native or always-on service. Decision: build an AEGIS-native computer-use capability behind isolated worker adapters, Sentinel, explicit per-action approvals, a secret vault, redacted audit, cost limits and durable server-side jobs. Never expose raw browser, shell or filesystem access to an agent.

## Explicit non-goals

- No direct dependency on either Strata project or Nod.
- No model-generated memory automatically accepted as fact.
- No vector database or GPU requirement for the first memory release.
- No arbitrary computer control, shell access or unrestricted browser automation.
