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


## Source Provenance Register — pinned, owner-scoped reuse evidence

The Source Provenance Register records what was inspected and which licence obligations were actually checked before a source is reused or adapted. It is distinct from repository discovery and from the general Forge candidate catalogue.

- Each record is pinned to a 40- or 64-character immutable source revision; branch names and version labels are not accepted as revisions.
- The record includes inspection depth/time, source licence and licence-file URL, separately inventoried dependency/model/dataset/asset/font/build-tool licences, relevant AEGIS capabilities, decision and evidence URLs.
- Reuse, adaptation and combination are rejected if any source or component licence is unresolved.
- An `approved` record requires source-level or full inspection and verified licences for all inventoried components.
- Records are owner-scoped and deduplicated by owner + canonical source URL + immutable revision.
- D1 protects source identity and record content from mutation/deletion. A database trigger records creation in an append-only event table.
- The API is authenticated, same-origin for writes, JSON-only, body-bounded and returns no-store responses.

Owner-only Pages API:
- `GET /api/forge/provenance?limit=50` — list up to 100 records for the owner.
- `POST /api/forge/provenance` — validate and persist one provenance record; duplicate submissions return the existing record.

Migration: `migrations/forge/0004_source_provenance.sql`.

This is a provenance register, not an automatic legal opinion or licence scanner. A human must verify the actual source, dependency, model, dataset and asset terms. It does not install or execute upstream code. The API/migration must pass CI and be applied to a preview database before it can be called operational in a deployed environment.


## Candidate-to-provenance links

Forge can attach a candidate to its source provenance record without mutating either record.

- A link is allowed only when candidate and provenance belong to the same owner.
- The candidate's canonical source URL and pinned version must exactly match the provenance record's canonical URL and immutable revision.
- Rejected and archived candidates cannot receive new links.
- Links are stored separately in forge_candidate_provenance_links, with owner-scoped foreign keys and a unique owner/candidate/provenance tuple.
- Link records are append-only and do not alter candidate status or licence decisions.
- Owner-authenticated, same-origin API: POST /api/forge/candidates/:id/provenance.

Migration: migrations/forge/0005_candidate_provenance_links.sql.

## Read-only codebase intelligence — first JavaScript/TypeScript slice

Forge now includes a bounded, non-executing module-relationship analyser for supplied JavaScript/TypeScript source files.

- Library: functions/lib/forge-code-intelligence.mjs.
- Owner-authenticated, same-origin API: POST /api/forge/code-intelligence.
- Request shape: { "files": [{ "path": "src/main.ts", "content": "..." }] }.
- Output contains source nodes, resolved relative import/re-export edges, unresolved relative imports and external package references.
- Recognises static imports, re-exports, literal dynamic imports and literal CommonJS require() calls.
- Non-literal dynamic imports are ignored rather than guessed.
- Hard limits: 1,000 files, 512 KiB per file and 8 MiB total source content. Paths must be relative, unique and cannot traverse above the supplied source root.
- The API request body is streamed and bounded before parsing. Unknown top-level fields are rejected.
- The analyser never imports, evaluates, builds, installs or executes inspected source.

**Accuracy boundary:** this first slice is a heuristic scanner, not a full JavaScript/TypeScript parser. It can miss syntax forms and may misread import-like text in comments or strings. It reports only relationships it can resolve from the supplied file set; unresolved and external references are not evidence that a dependency is absent. It does not yet fetch an entire repository, inspect package manifests/lockfiles, build a complete dependency graph, map symbols/call graphs, or provide a UI.

The Forge panel now includes a multi-file/folder selector and an explicit Analyse action. It also supports selecting JavaScript/TypeScript files from the already-inspected public GitHub tree. The repository analysis endpoint re-fetches the tree, requires the exact pinned tree SHA, verifies every selected path/blob SHA against that tree, reads only those pinned blobs, and caps a selection at 50 source files. A changed tree returns a conflict and requires re-inspection; source content is not accepted from the browser for this repository-backed route. Selected text is read in the browser and sent only after the owner starts the analysis; the API repeats all server-side limits and path checks. The panel displays counts and the raw relationship graph. Browser-level runtime/accessibility verification is still outstanding. The next engineering stages are: connect the analyser to Forge's existing pinned GitHub file selection flow; add parser-backed analysis (Tree-sitter REA first); then expand the review UI with source/revision, coverage and confidence indicators. No source is executed and no findings are automatically accepted into Agent context.

Verification: GitHub Actions run 44034848114 completed successfully for commit b81030236da5d3566c2d0df86592d4efd9f3feb7. It includes the full Node.js suite, Miniflare runtime integration, isolated capability/runtime/Forge D1 migrations and safeguards. No preview/production D1 migration or deployment was performed.


### Pinned GitHub repository analysis

- Endpoint: POST /api/forge/repository-code-intelligence.
- Accepts only sourceUrl, treeSha and a selected files array of path/blob-SHA pairs.
- Re-inspects the public repository and requires the current recursive tree SHA to equal the user's pinned tree SHA. A changed tree returns HTTP 409 before any blob is read.
- Every selected path and blob SHA must exactly match the current inspectable tree entry; duplicate paths, non-JS/TS files, blobs over 32 KiB and selections over 50 files are rejected.
- The endpoint reads each selected blob by its Git object SHA and verifies returned SHA and byte size before analysis.
- The Forge UI exposes checkboxes only for eligible JS/TS entries from the inspected repository and submits only selected path/SHA pairs.
- This is a selected-file analysis, not a whole-repository audit. The inspector's tree listing is bounded and may be truncated; missing files are not proof of absence.
- Repository content remains untrusted data. No source is executed, installed, built or automatically accepted as knowledge.


## Tree-sitter parser REA

A source-level REA is recorded in docs/REA_TREE_SITTER_2026-11-17.md. The parser runtime/web binding and JavaScript/JSX and TypeScript/TSX grammars were inspected at immutable commits; all reviewed licence files are MIT. The official web binding documents WASM usage and precompiled WASM modules in Cloudflare Workers-style environments.

Decision: prototype/adapt, but do not add a production dependency yet. The next gate is an isolated, pinned WASM prototype with runtime compatibility, bundle size, memory, cold-start and parse-time measurements plus regression fixtures. No grammar package or WASM binary has been installed or copied into AEGIS.


### Isolated Tree-sitter WASM parser prototype

- Added scripts/forge-tree-sitter-prototype.mjs and focused tests in tests/forge-tree-sitter-prototype.test.mjs.
- Prototype uses pinned web-tree-sitter 0.28.0, tree-sitter-javascript 0.25.0 and tree-sitter-typescript 0.23.2 packages. CI installs these with scripts disabled; the parser consumes only grammar WASM and does not invoke native grammar build scripts.
- First extraction scope is syntax-node-backed static imports, re-exports, literal dynamic imports and literal CommonJS require calls. Import-like text in comments/strings and non-literal dynamic imports are excluded.
- Records per-file syntax-error presence; malformed syntax does not cause a false claim of complete parsing.
- Limits: 50 files and 32 KiB per file. Source is parsed as text and never evaluated.
- This is an isolated REA prototype only. The Forge production API remains on the existing heuristic analyser until browser/Workers compatibility, WASM packaging, performance, memory and regression gates pass.
- CI workflow run for the latest prototype commit is pending; do not treat this prototype as verified until it completes.
