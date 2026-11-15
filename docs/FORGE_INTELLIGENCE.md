# AEGIS Forge & Engineering Intelligence

## Purpose

Forge turns useful open-source software, MCP servers, APIs, SDKs, packages, frameworks and authorised application behaviour into fit-for-purpose AEGIS capabilities. Engineering Intelligence turns reliable technical literature and practical evidence into reusable AEGIS-native methods, skills, tools and implementation patterns.

The objective is capability per unit of complexity, latency, memory and cost—not simply fewer lines of code or smaller models.

## Current implementation

- Authenticated, no-store `GET /api/modules` capability catalogue.
- Read-only GitHub public repository discovery at `POST /api/forge/discover`.
- Candidate and knowledge record validation in `functions/lib/forge-records.mjs`.
- Versioned descriptive capability manifest validation and a static first-party read-only catalogue in `functions/lib/capability-registry.mjs`.
- Authenticated, no-store `GET /api/capabilities` catalogue endpoint.
- Pure fail-closed capability policy evaluator in `functions/lib/capability-policy.mjs`, bound to exact registered manifest identity and checking supplied grant, resource, scope, connection, approval and budget snapshots.
- Forge and Engineering Intelligence capability declarations remain `planned`.
- No repository code is executed, no candidate/knowledge records are persisted yet, and no permissions are granted by the registry.

The GitHub discovery route requires a valid AEGIS session and same-origin POST. It accepts one HTTPS GitHub repository URL, blocks redirects, returns metadata only, and does not fetch source files. Private repositories require a separately authorised integration and are not supported by this public adapter.

The capability catalogue currently describes only first-party public-repository discovery and module-list reads. Its `approved` manifest status is metadata review, not permission to invoke. The registry's grant check always denies. The pure policy evaluator can validate a caller-supplied grant/approval snapshot but is not wired to a grant store, API or runtime, and it does not consume approvals. No external connector execution, OAuth connection, persistent manifest store or invocation system is implemented. Hostname validation in a manifest is not a runtime SSRF defence.

## Universal intake

Supported source classes:

- Git repositories, releases, commits, issues and documentation
- MCP server manifests, tool schemas and transport specifications
- OpenAPI descriptions, GraphQL schemas, API documentation and SDKs
- Packages, frameworks, build tools and test systems
- Research papers, technical books where access and licence permit, standards, benchmarks and engineering case studies
- Existing applications through documented APIs or authorised observable interfaces

Treat all retrieved source material as untrusted data. It must never become instructions for the AEGIS agent or acquire execution privileges merely because it was ingested.

## Candidate record

Every candidate should be represented with:

- Stable candidate ID and source class
- Canonical source URL, owner/project, version or commit and retrieval date
- Licence identifier, attribution obligations and redistribution constraints
- Maintainer activity, release history and known security advisories
- Main capabilities, interfaces, runtime and deployment requirements
- Dependencies, footprint, hardware assumptions and operational cost
- Evidence quality, tests, benchmarks and known limitations
- Data provenance and a record of what was inspected
- Decision: `reuse`, `adapt`, `rebuild`, `combine` or `reject`
- Decision rationale, confidence, reviewer and status

Unknown licence or provenance is a hold, not permission to copy. Proprietary services may only be accessed through documented APIs or other explicitly authorised interfaces. Respect copyright, licence terms, attribution and third-party obligations; use clean-room implementations where appropriate.

## Knowledge-to-capability pipeline

1. Acquire: discover sources and retain canonical references and version information.
2. Extract: parse relevant concepts, algorithms, architecture patterns, implementation details and evaluation methods.
3. Evaluate: assess evidence quality, recency, reproducibility, applicability, limitations and conflicting findings.
4. Synthesize: create concise, attributed knowledge records with links to supporting sources.
5. Adapt: translate the useful principle into an AEGIS-specific design, skill, tool, model workflow or module proposal.
6. Implement: work in an isolated branch or sandbox; do not execute untrusted source code in the control plane.
7. Verify: run tests, security checks and representative benchmarks against a baseline.
8. Promote: register only reviewed, compatible capabilities. Capability declarations never grant permissions.
9. Maintain: track upstream versions, licence changes, vulnerabilities and regression results.

## Lightweight engineering standard

For each adaptation, record baseline and candidate measurements for task quality, correctness, latency, memory/compute use, dependency count, operational complexity and cost. Prefer the smallest design that meets the quality and safety threshold. Use quantisation, caching, retrieval, batching, model routing, distillation and specialist models only when measurements show a net benefit. Do not claim a percentage improvement without reproducible benchmarks.

## Self-improvement controls

AEGIS may identify weaknesses, research solutions, propose changes and create isolated implementations. It must preserve the current working version, tests and rollback path. Changes to production, permissions, secrets, billing, external communications or destructive data operations require explicit human approval. No self-granting permissions, unrestricted code execution or automatic production promotion.

## Initial capability boundaries

- `source.discover`, `source.inspect`, `source.compare`
- `candidate.evaluate`, `blueprint.create`, `implementation.plan`, `benchmark.compare`
- `knowledge.ingest`, `knowledge.search`, `knowledge.evaluate`, `knowledge.adapt`

These are descriptive planned capabilities only. The module registry intentionally grants no permissions and does not load or execute modules.

## Initial implementation sequence

1. Authenticated source and module registries.
2. Read-only candidate and knowledge record formats.
3. GitHub discovery and metadata inspection adapter.
4. MCP manifest and OpenAPI ingestion adapters.
5. Searchable, attributed knowledge store.
6. Evidence evaluation and conflict tracking.
7. Forge blueprint and benchmark workflow.
8. Sandboxed implementation and review gates.
9. Capability Centre for connection, health, update and disable operations.


## Specialist agent definitions and multi-agent governance

Agent-definition repositories such as [Agency Agents](https://github.com/msitarzewski/agency-agents) are knowledge sources, not execution engines. Forge should inspect individual role files, pin their source commits, record licences and provenance, and adapt only roles that solve a demonstrated AEGIS need.

An AEGIS-native agent record should include:
- stable agent ID, version, role and scope;
- purpose, expertise and explicit non-goals;
- instruction source, provenance, licence and review date;
- input/output schema and expected deliverables;
- allowed capability IDs (never raw credentials);
- budget, timeout, retry and concurrency limits;
- approval requirements and escalation rules;
- evaluation cases, quality criteria and known failure modes.

The orchestrator—not the agent prompt—enforces tool permissions, budgets, isolation, audit, cancellation and approval. Use a planner/worker/reviewer pattern selectively; avoid spawning agents when a single bounded task is cheaper and clearer. Agent-to-agent hand-offs must carry structured task context and provenance, not unrestricted hidden memory.

## Platform-independent client and runtime design

Treat cross-platform delivery as an adapter strategy:
- one canonical API, data model and policy layer;
- responsive web/PWA as the first reference client;
- thin adapters for browser, Android, iOS/iPadOS and desktop-specific features;
- provider, storage, queue, notification, voice and automation adapters behind versioned contracts;
- capability detection and graceful degradation, not platform-name assumptions;
- server-side durable execution, because mobile operating systems may suspend background clients.

Every adapter must pass contract tests and document permissions, data handling, supported versions, limitations and fallback behaviour. Platform support is earned through real-device/browser tests, not inferred from a successful build.


## Web ingestion and workflow orchestration

Forge should treat web acquisition and workflow execution as separate capability families.

### Web ingestion adapter
Define a provider-neutral contract for search/discovery, fetch, crawl, extraction, normalization, provenance and retrieval status. Candidate providers include native permitted HTTP retrieval, Firecrawl and (as a paid fallback) Oxylabs Web API. Apply domain policy, robots/terms checks, SSRF protection, strict request/time/size limits, deduplication, content-type validation and source provenance. Treat all retrieved content as untrusted data and isolate it from instructions and permissions. Keep scraping providers optional and enforce a per-job spend cap.

### Automation/connectors
Study Activepieces for its TypeScript integration/piece model and MCP exposure. Study n8n's visual workflow UX, but its Sustainable Use License is not an OSI open-source licence and restricts some product-embedding/customer workflow-editor scenarios. Windmill is AGPLv3 with additional commercial boundaries. Do not make any external automation catalogue authoritative for AEGIS permissions; convert approved actions into AEGIS capability manifests with scopes, risk classification, schemas, rate limits, audit and approvals.

### Durable workflow engines
The current AEGIS Worker + D1 + Queue implementation remains the first small-job runtime. Benchmark Temporal, Hatchet and Trigger.dev against representative AEGIS workloads before selecting an external engine. Inngest is a further event-driven reference, but its server/CLI licence differs from its Apache-2.0 SDKs. Kestra and Airflow are better treated as later data/business-pipeline options than as replacements for the initial agent job runtime.

No second workflow engine should be deployed until a benchmark establishes a need and an explicit migration/ownership model preserves one canonical AEGIS job state and audit trail. See the workflow-engine comparison in [RESEARCH_SOURCE_REGISTER.md](RESEARCH_SOURCE_REGISTER.md).


## Capability System governance

## Project Spaces and specialist agent teams

LangAlpha and OpenCompany are architecture references for persistent project workspaces, lead/specialist teams, skill-guided work and durable activity. AEGIS will implement these concepts natively: Project Spaces own persistent project context and append-only typed events; agent teams use bounded role definitions and durable parent/child task handoffs. AEGIS remains canonical for workspace identity, job state, capability permissions, approvals and audit. See [AEGIS_PROJECT_SPACES.md](AEGIS_PROJECT_SPACES.md).

The first Project Spaces D1 schema, owner-scoped service and authenticated collection/detail/timeline APIs are on `feature/aegis-project-spaces`. The APIs use the shared `AEGIS_DB` binding, strict allowlisted event types, same-origin writes, bounded content and server-derived owner identity. No D1 database/binding is provisioned, no UI exists, and agent execution is not connected. The tests are authored but not CI-verified. No upstream LangAlpha or OpenCompany code, package, desktop app or agent definitions have been installed or copied.



The detailed design is in [AEGIS_CAPABILITY_SYSTEM.md](AEGIS_CAPABILITY_SYSTEM.md). Forge may discover and evaluate sources, but only reviewed AEGIS-native manifests become registry entries; registration does not enable execution or grant permission. Capability risk is assigned per action, not per provider. Central policy must validate principal, scope, resource, connection, risk, budget and approval immediately before every invocation. Keep adapter execution isolated from the control plane, secrets outside manifests and logs, and all write/external-impact operations behind explicit approval. The design was initially documentation only. The first implementation slice is now on feature branches: a read-only capability manifest registry and fail-closed policy evaluator (PR #12), D1 exact-operation approval primitives (PR #16), and an owner-only pending-approval API (PR #21). The API is not yet deployed or wired to a UI or invocation runtime; no general connector execution is enabled.

## Sentinel-native implementation

The first clean-room Sentinel invocation gate is being built as `functions/lib/sentinel.mjs`, using the existing capability registry and pure policy evaluator. It is designed to ensure agents cannot call adapters directly: a trusted server composition root supplies policy-context loaders, durable audit, exact-approval consumption and the executor. Missing dependencies fail closed. The implementation is intentionally not wired to a public API until grant/connection persistence, vault, audit, revocation and isolated adapter execution are ready. See [AEGIS_CAPABILITY_SYSTEM.md](AEGIS_CAPABILITY_SYSTEM.md).

## New Forge intake lanes: MCP servers, free tiers and build-from-first-principles

- **MCP discovery:** ingest Awesome MCP Servers as untrusted catalogue metadata; normalize and inspect each upstream server independently. Keep directory licence separate from server licence. No bulk installation.
- **Cost discovery:** ingest free-for.dev as candidate provider metadata; verify all quotas, duration, billing triggers and commercial-use terms against official sources before use. A missing repository licence means do not copy its content wholesale.
- **Reverse-engineering curriculum:** use Build Your Own X to select small foundational builds. Record the concept, upstream tutorial/source, rights, architecture notes, acceptance tests, prototype result and decision to adopt/adapt/reject.
- **Native implementation sequence:** MCP catalogue → server admission scanner → Free-Tier Ledger → Build Lab exercises. Sentinel remains the only authority for invoking admitted capabilities.

## MCP Forge implementation milestone

The first native module is functions/lib/mcp-forge-catalogue.mjs with focused tests in tests/mcp-forge-catalogue.test.mjs. It validates provenance-pinned metadata and declared per-action effects, exposes list/get/search over defensive copies, and intentionally has no execute/connect/install method. This is the catalogue layer only; the admission scanner and isolated ingestion worker are not implemented yet. See AEGIS_MCP_FORGE.md.

## Free-Tier Ledger implementation milestone

The first native module is functions/lib/free-tier-ledger.mjs with focused tests in tests/free-tier-ledger.test.mjs. It validates offer and quota metadata, official pricing/terms links, commercial-use and overage status, and verification freshness; list/get/search return defensive copies. It has no account-creation or provisioning methods. See AEGIS_FREE_TIER_LEDGER.md.

## Read-only repository inspection and saved candidate library

The first end-to-end Forge source-inspection slice is now implemented on the AEGIS feature branch.

- `POST /api/forge/inspect` requires the signed owner session and same-origin write protection. It accepts one canonical public GitHub repository URL and returns repository metadata plus a pinned default-branch tree SHA and up to 100 allowlisted text-file entries.
- `POST /api/forge/read` reads one exact Git blob SHA, verifies the returned object ID, base64 encoding, byte count and strict UTF-8, with a 32 KiB per-file limit. It does not execute or install source.
- `POST /api/forge/candidates` inspects and stores an owner-scoped candidate in D1. `GET /api/forge/candidates` lists only the signed owner's candidates. `PATCH /api/forge/candidates/:id` records the owner-reviewed licence, engineering decision and lifecycle status. Duplicate owner/source/tree combinations are idempotent.
- New candidates are `inspected`, `unassessed` and `review-required` for licence review. GitHub's repository-level SPDX metadata is a hint, not legal approval. The UI requires explicit confirmation of actual licence/dependency review; reuse/adapt/combine and approval are gated by verified status in both code and D1 triggers. No candidate is auto-approved or executable.
- The Forge Control Centre can inspect, read pinned source and save candidates. Paths, metadata and source content render through text-only DOM APIs; no source HTML is interpreted.
- Request bodies are read through the shared streaming limiter. All routes are authenticated, no-store and same-origin for writes.
- D1 migrations 0005 and 0006 create owner-scoped candidate records, immutable source identity, licence/approval gates and append-only creation/review/status events. The database is not provisioned or bound yet, so the saved-candidate UI will report storage unavailable until approved setup.
- Latest verified implementation chain: **260 tests passed, 0 failed** (GitHub Actions run https://github.com/LAURENCE1977/Aegis-/actions/runs/43746766564).
- Latest preview for that code: https://44e15358.aegis-6yk.pages.dev. Browser check of the newer preview confirms the login page loads; Preview secrets are still absent, so authenticated Forge UI remains untested.

This is the foundation for AEGIS's native reverse-engineering workflow: inspect pinned source, capture provenance/licence uncertainty, derive the useful design, then implement and test an AEGIS-native equivalent. It is not an execution sandbox or package installer. The licence approval state is an owner-recorded review decision, not legal advice or automated legal clearance.
