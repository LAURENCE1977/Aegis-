# AEGIS Forge & Engineering Intelligence

## Purpose

Forge turns useful open-source software, MCP servers, APIs, SDKs, packages, frameworks and authorised application behaviour into fit-for-purpose AEGIS capabilities. Engineering Intelligence turns reliable technical literature and practical evidence into reusable AEGIS-native methods, skills, tools and implementation patterns.

The objective is capability per unit of complexity, latency, memory and cost—not simply fewer lines of code or smaller models.

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
