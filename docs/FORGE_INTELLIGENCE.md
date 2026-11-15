# AEGIS Forge & Engineering Intelligence

## Purpose

Forge turns useful open-source software, MCP servers, APIs, SDKs, packages, frameworks and authorised application behaviour into fit-for-purpose AEGIS capabilities. Engineering Intelligence turns reliable technical literature and practical evidence into reusable AEGIS-native methods, skills, tools and implementation patterns.

The objective is capability per unit of complexity, latency, memory and cost—not simply fewer lines of code or smaller models.

## Current implementation

- Authenticated, no-store `GET /api/modules` capability catalogue.
- Read-only GitHub public repository discovery at `POST /api/forge/discover`.
- Candidate and knowledge record validation in `functions/lib/forge-records.mjs`.
- Forge and Engineering Intelligence capability declarations remain `planned`.
- No repository code is executed, no candidate/knowledge records are persisted yet, and no permissions are granted by the registry.

The GitHub discovery route requires a valid AEGIS session and same-origin POST. It accepts one HTTPS GitHub repository URL, blocks redirects, returns metadata only, and does not fetch source files. Private repositories require a separately authorised integration and are not supported by this public adapter.

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

The detailed design is in [AEGIS_CAPABILITY_SYSTEM.md](AEGIS_CAPABILITY_SYSTEM.md). Forge may discover and evaluate sources, but only reviewed AEGIS-native manifests become registry entries; registration does not enable execution or grant permission. Capability risk is assigned per action, not per provider. Central policy must validate principal, scope, resource, connection, risk, budget and approval immediately before every invocation. Keep adapter execution isolated from the control plane, secrets outside manifests and logs, and all write/external-impact operations behind explicit approval. The design is currently documentation only.


## Mercury Agent — agent-runtime reference

Mercury Agent is a useful reference for a persistent local daemon, tool permission manager, scoped second-brain memory, specialist bots, budgets, scheduler, provider/channel adapters and run-oriented UX. Its MIT licence permits review and selective adaptation subject to preserving licence/provenance notices.

Do not import Mercury wholesale. It is Node.js 22+ and local-runtime oriented, duplicates AEGIS's core responsibilities, and explicitly documents that it has no OS-level sandbox. Its own roadmap/security material warrants additional scrutiny of delegated permission contexts, evidence-gated completion, SQLite packaging and platform support. Community skills are not audited.

Potential Forge extracts are architectural patterns, not copied authority: per-agent scope manifests, permission-context inheritance tests, private-by-default memory namespaces, bounded bot concurrency, durable leases/idempotency, token/time budgets and inspectable run history. Re-express each as an AEGIS-native contract, with regression tests and a central policy check before every invocation. See [RESEARCH_SOURCE_REGISTER.md](RESEARCH_SOURCE_REGISTER.md).

## Google Chrome Modern Web Guidance — browser-platform knowledge and evaluation

[GoogleChrome/modern-web-guidance-src](https://github.com/GoogleChrome/modern-web-guidance-src) is the source/authoring repository for [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance). It supplies coding-agent skills for modern browser APIs, CSS/layout, accessibility, performance, forms, PWA behaviour, privacy and built-in browser AI. The source repository contains authoring and build tools, a RAG/use-case search and retrieval CLI, deterministic legacy-pattern analysis, browser compatibility data and an evaluation harness using Playwright and multiple coding agents.

**Licensing is mixed by content:** source software is Apache-2.0; guide content under `guides/` is CC BY 4.0, with some content derived from MDN and web standards. Preserve attribution and source provenance when adapting guidance. Google Open Source contributions require a CLA; new guide topics/significant changes require a proposal first. The project documents a source repo plus a separate read-only distribution repo and regular publication flow.

**AEGIS decision: very high priority knowledge source and web-development quality gate; integrate selectively.**
- Use published skill/CLI retrieval for targeted web tasks rather than cloning or embedding the entire source authoring toolchain.
- Add a Modern Web Guidance retrieval adapter to Forge/Knowledge: query by task, retrieve selected guide IDs, record package version, guide ID, source URL, licence, retrieval date and compatibility caveats.
- Use its deterministic legacy scan as an optional audit, not as a complete code-quality or security scan; the project says it covers only a subset of the guidance corpus.
- Borrow its Playwright-based task/evaluation methodology for AEGIS's own responsive UI, accessibility, browser-compatibility and agent coding evaluations.
- Make browser support a capability matrix and verify actual feature support; modern APIs require fallbacks and must not be assumed to exist on every browser/device.

**Operational caveats**
- The inspected source repository requires Node.js >=22.18 and pnpm; full preflight includes build, typecheck, lint and tests. Its source authoring/evaluation harness is far heavier than the compact published skills.
- The CLI documentation describes anonymous usage telemetry, including installation counts, guide retrieval IDs and search queries; it documents `DISABLE_TELEMETRY=1` as an opt-out. Confirm the exact release's telemetry behaviour and privacy requirements before use.
- Keep this as guidance data and an optional analysis tool, not a runtime dependency or a source of executable browser privileges.
- The source project is actively governed; don't fork or redistribute modified guidance without following its licence, attribution and contribution rules.

No package, CLI, plugin or repository code has been installed or run in AEGIS.


## Addy Osmani Agent Skills — engineering workflow source

[addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) is an MIT-licensed, multi-host pack of 25 Markdown skills, four reviewer personas, seven shared checklists, command wrappers and evaluation tooling. It is a high-value source for engineering workflow design, not a runtime or permission system.

**Adapt first:** constraint-driven development, context engineering, source-driven development, doubt-driven development, incremental implementation, planning, systematic debugging, security hardening, API design, frontend engineering, browser testing, performance, observability, ADRs and safe shipping.

**Avoid duplication:** AEGIS already has ten native Superpowers-derived skills and existing TDD/spec/review procedures. Compare coverage and merge complementary practices into the canonical AEGIS skill rather than registering duplicate workflows. Pin upstream commit and preserve MIT attribution for copied or substantially adapted material.

The upstream four personas (code reviewer, test engineer, security auditor, web-performance auditor) should become AEGIS role definitions with explicit capability grants and central policy enforcement; they do not receive permissions merely by being assigned a persona. Shared checklists should be packaged with any adapted skills because per-skill installation omits the repository-level `references/` directory. Do not copy upstream contributor-only `AGENTS.md` or install its host-specific command wrappers as AEGIS runtime code.

**AEGIS integration path:** provenance-aware skill registry → overlap and risk review → AEGIS-native adaptation → contract/evaluation tests → versioned publication → explicit enablement. The source register records the detailed evaluation.


## CoreDeck — optional Android tooling and QA reference

[devmuaz/CoreDeck](https://github.com/devmuaz/CoreDeck) is an MIT-licensed native C++20 desktop interface over official Android SDK/JDK tools. Its scope includes AVD and system-image management, emulator launch/logs, ADB/device workflows, SDK/JDK health checks, APK inspection/signing and keystore management. The project publishes Windows, macOS and Linux builds; it is not a ChromeOS browser tool or an iOS/iPadOS testing solution.

**AEGIS decision: reference-only / optional external Android QA utility.** It is not an agent runtime, CI service, remote browser or durable job engine, and it does not solve the Chromebook-first workflow. Do not add it to the core deployment.

If an Android client becomes a real delivery target, evaluate a narrow isolated device-host adapter rather than embedding CoreDeck. Keep ADB and signing operations behind action-level capability policy, disposable test devices/accounts, explicit approvals for consequential actions, encrypted key references and redacted audit logs. Capture emulator/device logs and test evidence without exposing private signing material.

Before use, pin the exact release/commit and verify checksums, bundled dependency licences, update path, telemetry and host-process security. No CoreDeck software has been installed or connected.

## New Forge candidates — browser, code graph, model routing and media

### Vercel agent-browser
Treat https://github.com/vercel-labs/agent-browser as an optional isolated browser-worker adapter. Apache-2.0 Rust CLI with accessibility-tree snapshots, element references, screenshots and stdio MCP. It requires a host runtime and Chrome; it is not a Cloudflare Worker or iOS Safari automation library. Before use, isolate the browser profile and host, enforce domain/action policies, require approvals for consequential actions and treat page content as untrusted. The repository has no published SECURITY.md, so review source before execution.

### Code Review Graph
https://github.com/tirth8205/code-review-graph is a high-priority optional engineering intelligence adapter: MIT, local SQLite/Tree-sitter graph, CLI/MCP, impact analysis, risk-scored reviews and multi-repository context. Evaluate on AEGIS itself and measure actual review accuracy/context savings. Use installer dry-run and inspect changes; keep graph read-only initially. It is not canonical memory or job state.

### FlashML FreeToken
https://github.com/FlashML-org/FreeToken is an Apache-2.0 local inference engine, not a free hosted API token service. Its CLI currently expects Linux x86_64 and NVIDIA/CUDA hardware; Windows/Linux desktop downloads are listed. Consider only as a future local-model provider on a capable GPU host. It does not solve Chromebook/iPad compute.

### 9Router
https://github.com/Raisolah/9router is a possible model-router reference, but security hold. Public advisories describe critical unauthenticated provider/key/history exposure in <=0.4.41 and a separate high-severity Host-header auth bypass/SSRF flaw before 0.5.2. Later releases do not remove the need to audit the exact fork/commit and reproduce fixes. Do not connect personal/production credentials. AEGIS retains its own provider router and policy authority.

### OpenCut
https://github.com/OpenCut-app/OpenCut is an MIT video-editor project being rewritten with planned Editor API, MCP and headless automation. These are roadmap items, not current proven interfaces. Archive opencut-classic is read-only. Keep it as a future Media Studio reference, not a current core dependency.

No candidate has been installed or connected. All are provenance-tracked research only.
