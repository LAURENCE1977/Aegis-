# AEGIS Research Source Register — UI, Agent OS and Developer Communities

Reviewed: 15 November 2026

This is an evaluation register, not an integration claim. No external package, agent platform or service below has been installed or granted access to AEGIS.

## Priority assessment

| Source | Best AEGIS use | Recommendation |
|---|---|---|
| Vercel AI SDK / AI SDK UI | Provider-neutral model/tool layer, streaming chat UI, typed tool calls, approvals, MCP | High-priority architecture reference; selective adoption after stack-fit review |
| Vstorm AgenticOS | Governed-agent architecture, shared knowledge, budgets, approvals, audit and operator console | Study and selectively adapt; do not deploy wholesale |
| Google ARTEMIS | Android UI automation, real-device testing, MCP-driven test execution and diagnostic traces | High-value optional mobile QA adapter if AEGIS ships/tests an Android client; not an AEGIS runtime dependency |
| TruffleHog | Secret discovery in AEGIS repositories, history and CI artifacts | High-priority security control to evaluate for isolated CI scans; do not automatically verify or expose detected credentials |
| OpenHarness (assumed autonomous-ai/openharness) | Multi-agent workspace, remote machine daemons, agent sessions and cross-machine coordination | Strong architecture candidate to study; desktop/daemon stack is not directly deployable on the current Chromebook-first Cloudflare setup |
| Harness.io platform (alternate interpretation of “Harness”) | Governed CI/CD, security testing, release controls, policy, audit and cost governance | Architecture reference; defer platform integration because it is broader and likely heavier than AEGIS needs |
| BLA (assumed qybaihe/bla, Blind LLM Agents) | Protect shipped binaries and bundles from automated reverse engineering | Niche optional release-hardening experiment only if AEGIS ships valuable client-side artifacts |
| SolidCraft | Parametric 3D CAD, browser/desktop modelling, CLI and MCP-driven model creation | Future Media Studio / 3D asset capability reference; unrelated to current core runtime |
| Dev.to | Discover practitioner articles, implementation notes and emerging patterns | Research input only; verify claims against primary sources |
| Stack Overflow | Troubleshooting, edge cases, failure modes and practical implementation evidence | Research input with strict attribution/licence handling |
| Frontend Mentor | Realistic UI challenges and independent frontend quality benchmarks | Optional UI/UX acceptance-test inspiration |
| v0 (assumed from “vo”) | Rapid UI prototypes and design exploration against GitHub branches | Optional prototyping tool; not a runtime dependency |
| Blackbox AI | External coding-agent orchestration, sandboxed runs, multi-agent comparison and PR workflow | Potential optional Forge adapter; defer pending security, API and cost review |

## Vercel AI SDK and AI SDK UI

Sources:
- https://github.com/vercel/ai
- https://ai-sdk.dev/docs
- https://ai-sdk.dev/docs/ai-sdk-ui/overview
- https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools
- https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage

Useful capabilities:
- AI SDK Core offers a common TypeScript interface for model generation, structured output, tool calling and agent loops across providers.
- AI SDK UI offers streaming chat/completion/structured-object hooks across supported UI frameworks.
- Tool calls can be server-executed, client-executed or held for user approval.
- MCP client support includes Streamable HTTP; HTTP is recommended for production, while stdio is intended for local connections.
- Current AI SDK 7 materials describe durable WorkflowAgent execution, approvals, sandbox support, harness integration and observability.

AEGIS decision:
- Leading implementation reference for the future provider router and interactive assistant UI.
- Preserve AEGIS's existing framework and Cloudflare architecture. Do not add a React-only dependency to a non-React surface without checking the actual frontend stack and bundle/runtime impact.
- Prefer protocol compatibility and small adapters over adopting the entire Vercel platform.
- Evaluate SDK version, Cloudflare Workers compatibility, package size, provider support, licence and API cost before installation.
- The current AEGIS MCP Bridge is a server endpoint; a future outbound MCP client is a separate capability.

## AgenticOS

Primary candidate:
- https://github.com/vstorm-co/agenticos
- Repository reports Apache-2.0 licensing.
- Described stack: FastAPI, Pydantic AI, PostgreSQL/pgvector, Redis and Next.js, with MCP integrations, access controls, budgets, approvals and audit.

Useful patterns:
- Separate agent runtime from the operator-facing console.
- Shared runner across UI/API/chat channels.
- Explicit budgets, access roles, tool allowlists, approval gates and run audit.
- Knowledge ingestion and agent configuration separated from code-defined capabilities.

AEGIS decision:
- High-value architecture and security-review reference.
- Do not fork or deploy wholesale at this stage. The documented infrastructure footprint (PostgreSQL/pgvector, Redis, Docker and a server-class host) conflicts with AEGIS's current low-cost Cloudflare/mobile-first direction.
- Extract patterns, not framework lock-in. Any copied code must be independently licence-reviewed and tested.

Other similarly named Agentic OS repositories exist. Pin exact owner/repository, commit and licence before evaluation.

## Google ARTEMIS

Primary candidate:
- https://github.com/google/artemis
- Google repository reports Apache-2.0 licensing.
- Natural-language Android automation with real-device/emulator execution, UI hierarchy and visual targeting, task traces, CLI/Python SDK, web console and an MCP server.

Useful capabilities:
- Exercise real Android app workflows instead of relying only on mocked browser tests.
- Capture screenshots, logs and execution traces for reproducible bug reports.
- Expose mobile test execution to compatible coding agents through MCP.
- Separate fast reactive execution from a more deliberate plan/execute/check workflow.

AEGIS decision:
- Strong optional QA adapter for a future Android AEGIS client or Android-specific companion workflow.
- Not a fit for the current Cloudflare Worker runtime: it expects a separate Python/ADB-capable host and an attached Android device or emulator.
- The user's primary devices are Chromebook, iPad and iPhone; ARTEMIS is Android-only today, so it does not solve iOS testing and should not be treated as a general mobile automation layer.
- If trialled, isolate the device host, use a disposable test device/account, restrict MCP tools to test actions, and require approval before any action that sends messages, makes purchases, changes accounts or affects real data.
- Validate Google's published benchmark claims independently; benchmark scores are not a guarantee for AEGIS-specific workflows.

## TruffleHog

Primary candidate:
- https://github.com/trufflesecurity/trufflehog
- Official README: https://github.com/trufflesecurity/trufflehog/blob/main/README.md
- Since v3.0, the repository states it is licensed AGPL-3.0. Check the exact release and licence before embedding or redistributing any component.

Useful capabilities:
- Discover and classify credentials across Git repositories, filesystems, logs and supported external sources.
- Distinguish detected, verified and unknown credentials; verification can contact the corresponding external service.
- Run as a standalone scanner and integrate into CI/pre-commit workflows.

AEGIS decision:
- High-priority candidate for a controlled secret-scanning gate on AEGIS source and release workflows.
- Prefer a pinned standalone CLI or isolated CI action over importing its code into AEGIS, subject to licence, provenance, supply-chain and runner review.
- Start with local/repository-history detection that does not attempt live credential verification. Do not print secret values in logs, PR comments or AEGIS memory; redact findings and restrict access.
- Live verification may send authentication attempts to external providers and reveal whether a credential is active. Keep it disabled unless separately authorised and explicitly scoped.
- Scanner findings are sensitive security incidents: record file/commit references and remediation status, not raw credential material. Rotate/revoke exposed credentials rather than merely deleting the visible line.
- A clean scan is not proof that no secrets exist; combine with least-privilege secret storage, secret rotation and review of CI logs/artifacts.

## OpenHarness and Harness (identity unresolved)

Two materially different candidates surfaced; do not conflate them:

### OpenHarness — autonomous-ai/openharness

Primary candidate:
- https://github.com/autonomous-ai/openharness
- Repository reports MIT licensing; pin and verify the exact commit and all bundled third-party licences before reuse.
- Describes a desktop command centre for running coding agents across multiple machines, with per-machine daemons, persistent agent sessions, remote coordination and end-to-end encrypted links. The repository includes app, CLI, daemon, relay and device components.

AEGIS decision:
- Highly relevant architecture reference for the user's long-term goal of coordinating multiple agent harnesses and machines while keeping work running independently of a chat session.
- Study its session lifecycle, daemon connectivity, encrypted transport, machine pairing, permissions and failure recovery. Do not assume its relay, desktop app or local agent processes can be transplanted into Cloudflare Workers.
- Its documented build/install path targets macOS or Linux and includes native desktop/toolchain requirements; it is not a direct Chromebook-only browser solution. Treat it as a possible optional operator/worker node, not AEGIS's core host.
- Before any integration, inspect security model, key management, relay trust boundaries, update mechanism, data retention, supported agent adapters and whether the daemon can run headlessly on a low-cost host.

### Harness.io platform — alternate interpretation

Primary candidate:
- https://www.harness.io/products/platform

The Harness platform describes a governed software-delivery layer spanning builds, deployments, testing, application security, runtime protection, cost management, policy-as-code, RBAC, approvals and audit. It also describes an agent harness and SDLC knowledge graph.

AEGIS decision:
- Study its governance model: policy enforcement at execution boundaries, worker agents with bounded permissions, evidence-backed audit, release verification and rollback.
- Do not adopt the full platform as an AEGIS dependency. It is a broad commercial DevOps platform aimed at organisational delivery environments, not a lightweight personal runtime.
- Reproduce the useful principles in AEGIS-native controls and keep CI provider-neutral.

The user has not supplied an exact Harness URL, so the intended project remains unconfirmed.

## BLA — Blind LLM Agents (provisional identity: qybaihe/bla)

Primary candidate:
- https://github.com/qybaihe/bla
- Repository reports MIT licensing; pin and re-check the exact release before use.
- CLI, MCP server and agent skill intended to make shipped binaries/bundles more expensive and misleading for automated AI reverse-engineering while preserving intended runtime behaviour.

AEGIS decision:
- Niche release-hardening candidate, not a general security scanner or agent safety boundary.
- Relevant only if AEGIS distributes client-side binaries, Electron apps, bundles, WASM or other supported artifacts that need protection from automated reverse engineering.
- Do not run its setup against global agent configuration. If evaluated, use an isolated disposable workspace and explicit output directory, inspect every transformation, verify functional equivalence in staging, and measure artifact-size/runtime impact.
- Avoid enabling LLM-directed decoys or deceptive directives without a specific, reviewed use case.
- Never treat obfuscation/decoys as a substitute for protecting server-side secrets, signing releases, secure design or access controls.

## SolidCraft

Primary candidate:
- https://docs.solidcraft.io/
- Documentation states MIT OR Apache-2.0 licensing.
- Described as a Rust parametric 3D CAD application available as desktop software, browser app, headless CLI and MCP server. The same command model is used by the UI, scripts, CLI and MCP.

AEGIS decision:
- Interesting future Media Studio / 3D asset-generation integration, especially because the command surface is scriptable and MCP-accessible.
- Not relevant to the current AEGIS runtime, orchestration or mobile Control Centre; do not add it to the core deployment.
- Before any adapter, verify repository maturity, supported modelling operations, WebGPU/WebGL browser requirements, MCP transport/security, export formats and dependency footprint.
- Keep generated CAD files in a sandboxed project workspace and require review before publishing or overwriting user assets.

## Dev.to

Use it to discover practitioner reports, tutorials, postmortems and emerging tools. Treat posts as leads, not authoritative specifications. Record author, canonical URL, publication/update date and linked primary sources. Verify claims against official documentation, source code, standards or reproducible tests. Do not bulk-copy articles into AEGIS; store concise attributed notes and links subject to site terms and copyright.

## Stack Overflow

Use it to find concrete error cases, compatibility issues, edge conditions and troubleshooting paths. Link answers to the exact product/runtime version they discuss.

Public contributions are licensed under Creative Commons Attribution-ShareAlike; the applicable licence depends on contribution date/revision (CC BY-SA 2.5, 3.0 or 4.0). Preserve attribution and applicable share-alike obligations when reusing content. Do not bulk mirror Q&A or assume accepted/upvoted answers are correct. Prefer original documentation and reproduce solutions in AEGIS tests.

Official licence information: https://stackoverflow.com/help/licensing

## Frontend Mentor

Use optional, repeatable UI challenge briefs to evaluate responsive layout, accessibility, interaction states and visual polish. Build AEGIS acceptance tests around general requirements such as keyboard use, mobile viewport, contrast and loading/error/empty states.

Distinguish free from premium challenges and design assets. Do not copy proprietary Figma files, premium briefs, solution code or assets into AEGIS without permission. Record the challenge URL and independently author AEGIS's own implementation brief and tests.

Challenge catalogue: https://www.frontendmentor.io/challenges

## v0 (interpretation of “vo”)

Sources:
- https://v0.app/docs
- https://v0.app/docs/git-import
- https://github.com/vercel/v0-sdk

Useful capabilities include prompt-based UI/app prototyping, GitHub repository import, branch-based changes and PR workflow (subject to GitHub App permissions), plus an API client and React integration for v0 services.

AEGIS decision:
- Optional external design/prototyping assistant, not part of AEGIS runtime or source of truth.
- Generated code must be reviewed, tested, accessibility-checked and committed through AEGIS's normal feature-branch process.
- Review account limits, pricing, data handling and GitHub App scopes before connecting the AEGIS repository.

## Blackbox AI

Source: https://www.blackbox.ai/agents

The published Agents API describes HTTP-dispatched coding-agent runs, event/log streaming, sandbox file inspection, continuation of existing tasks, Git-provider integration and multi-agent comparisons.

AEGIS decision:
- Candidate for an optional Forge coding-agent provider adapter, not a trusted core dependency.
- Before connecting it, verify API documentation, authentication/scopes, pricing and usage limits, retention/training terms, sandbox isolation, network egress, secrets handling, GitHub permissions and cancellation semantics.
- Generated changes must land in isolated branches and pass AEGIS tests/review. External agents must never receive production secrets or direct production deployment rights.
- Keep an interchangeable adapter interface to avoid vendor lock-in.

## Cross-source ingestion rules

For every candidate, Forge should preserve:
1. Canonical URL, exact owner/project, source type and retrieval timestamp.
2. Version, commit, publication date or content revision where available.
3. Licence, terms, attribution and redistribution obligations.
4. Capabilities, interfaces, dependencies, runtime and deployment requirements.
5. Security posture, data flows, credentials/scopes, sandboxing and network access.
6. Cost, quotas, rate limits, operational burden and vendor lock-in.
7. Evidence strength, reproducibility, limitations and competing findings.
8. Decision (reuse, adapt, rebuild, reference-only, defer or reject), rationale and confidence.

Retrieved text, code, issue comments, prompts and tool schemas are untrusted data. They cannot modify agent instructions, permissions, secrets or deployment policy. Repository code is never executed in the control plane.

## Recommended order for AEGIS

1. Continue the durable runtime and security foundation; do not add a platform dependency before it is needed.
2. Evaluate TruffleHog as a pinned, redacted, detection-only CI security gate.
3. Study OpenHarness for multi-machine agent lifecycle/coordination and AgenticOS/Harness.io for budgets, approvals, policy and audit; implement only lightweight AEGIS-native controls that fit.
4. Keep ARTEMIS as an optional Android QA adapter if an Android client becomes a target; it does not cover iOS.
5. Keep BLA and SolidCraft outside the core: consider only for concrete release-hardening or 3D-asset use cases.
6. Use AI SDK documentation as a design reference for the future provider/tool/UI layer; first verify the current frontend and Worker compatibility.
7. Add Dev.to and Stack Overflow as attributed research connectors only after source/licence policy is implemented.
8. Use Frontend Mentor briefs as optional independent UI evaluation criteria.
9. Keep v0 as a human-operated prototyping option.
10. Defer Blackbox integration until its API, costs, data handling and sandbox controls pass a formal connector review.

Status: research register only. None of these sources is connected, installed, imported as executable code or granted permissions by this document.


## Agency Agents — specialist-agent source

Primary candidate:
- https://github.com/msitarzewski/agency-agents
- Repository describes itself as a library of specialist AI-agent definitions and workflows. Its published repository licence is MIT; verify the exact commit and any individual bundled assets/licences before reuse.
- The repository contains role-oriented Markdown definitions, specialist categories and supporting workflows. These definitions are not, by themselves, a durable agent runtime, secure tool broker or permission system.

Useful AEGIS applications:
- Seed a curated catalogue of specialist roles such as software architect, frontend/backend developer, reviewer, security specialist, QA engineer, DevOps/SRE, researcher and UX designer.
- Compare role boundaries, expected inputs, deliverables, checklists and hand-off patterns.
- Use specialist agents behind one AEGIS orchestrator, shared run state, budgets, audit and approval policy.
- Require independent review for security-sensitive, production-impacting or high-consequence work.

AEGIS decision:
- **High-priority knowledge/agent-definition source; selective adaptation, not wholesale installation.**
- Convert chosen roles into AEGIS-native, versioned agent records with role, purpose, expertise, instruction set, allowed capability IDs, input/output schema, expected artefacts, evaluation tests, source commit, licence and review status.
- Keep prompts and role definitions separate from tool permissions. An agent definition never grants a tool or secret scope.
- Do not import the desktop installer or make AEGIS dependent on Claude Code, Cursor, Codex, Gemini CLI or any other specific agent host.
- Start with a small set of complementary roles and evaluate them against repeatable AEGIS tasks before expanding the catalogue.
- Preserve MIT attribution and upstream provenance; review all content for unsafe instructions, duplicated roles, prompt injection and platform-specific assumptions.
- No Agency Agents code or definitions have been installed, copied into the runtime or granted permissions by this research entry.

Source: https://github.com/msitarzewski/agency-agents



## Workflow, ingestion and always-on agent candidates — 15 November 2026

These candidates are architecture references or optional adapters. They are not installed, connected or granted permissions by this register.

### OpenDots — CopilotKit

Primary candidate: https://github.com/CopilotKit/OpenDots. MIT licence. An open-source web/mobile agent-workspace template using CopilotKit and AG-UI. It models persistent specialist "Dots", Spaces/pages, per-Dot research and memory permissions, MCP connections, human approval cards, activity receipts, browser/computer work and voice/Slack extensions.

The README says conversations require CopilotKit Intelligence (hosted service, local Docker evaluation, or licensed self-hosting). The local evaluation has substantial machine requirements and a CopilotKit account. The project describes itself as an early single-owner starting point; shared editing and some integrations/group-agent features remain further work. Its security notes say it is not a security-audited autonomous agent.

**AEGIS decision:** Very high-priority UX and agent-workspace reference. Study per-agent permissions, human approval, visible computer activity, persistent workspace and status presentation. Do not replace AEGIS core or copy its whole stack. Keep AEGIS identity, policy, durable jobs, memory and audit authoritative. Run computer/browser tools in a separate sandbox; require approval for writes, sends, purchases and deployments. Do not treat the starter as proof that 24/7 execution or production security is solved.

### Firecrawl

Primary candidate: https://github.com/firecrawl/firecrawl. Core repository is AGPL-3.0; some SDKs/UI components have separate licences. It provides web crawling, page scraping, site mapping and search/extraction workflows, with hosted and self-hosted modes. Scraping remains subject to target-site terms, robots directives, privacy rules and applicable law.

**AEGIS decision:** High-priority optional ingestion adapter, not a core dependency. Define a provider-neutral web-ingestion contract for discovery, fetch, crawl, normalize, provenance and status so native retrieval, Firecrawl or another provider can be swapped. Start with bounded permitted public-page retrieval. Enforce domain policy, robots/terms checks, SSRF protections (including DNS and redirect checks), request/time/size limits, content-type validation and deduplication. Store canonical URL, retrieval time, content hash, source version, licence/terms review and extraction method. Treat page content as untrusted prompt-injection input. AGPL-3.0 is a material distribution/modified-service consideration; isolate it behind an adapter and obtain legal review before distributing or offering a modified network service.

### Oxylabs Web API

Primary candidate: https://github.com/oxylabs/web-api. Commercial hosted service, not an open-source engine to embed. Provides web search and scraping with rendering, proxy rotation and geo-targeting. Public pricing advertises a small free trial and paid usage tiers; actual costs depend on product, result type and volume. Its acceptable-use policy restricts accessing non-public or sensitive personal data without permission and requires lawful, policy-compliant collection.

**AEGIS decision:** Defer as a paid fallback provider. Use only if ordinary web retrieval or a compliant Firecrawl setup cannot access a needed public source. Never make it a default dependency for the shoestring-budget build. Add hard spend caps, per-job budgets and usage telemetry; require explicit opt-in before paid requests. Restrict targets to permitted public information. Do not bypass access controls, collect sensitive data or evade site restrictions. Keep credentials server-side and assess data processing, retention and geographic handling before connecting.

### n8n

Primary candidate: https://github.com/n8n-io/n8n. Source-available under the Sustainable Use License (SUL) and separate Enterprise terms; it is not OSI-approved open source. Broad visual workflow automation with many integrations, custom nodes and AI-related features. n8n's current licensing FAQ says internal/private use is allowed in defined cases, but allowing outside customers to build/configure workflows, white-labelling or hosting n8n as a service requires a commercial licence.

**AEGIS decision:** Study its workflow-builder UX and connector catalogue; do not embed or fork as the AEGIS automation engine without written licence clearance. A private, single-owner instance could be considered as an optional external automation service, but it adds a separately operated system and must not become the source of truth for AEGIS jobs or permissions. If connected, expose only allowlisted webhook/API operations, isolate credentials, require approval for consequential actions and verify licensing for the exact use case.

### Activepieces

Primary candidate: https://github.com/activepieces/activepieces. Community Edition repository states MIT; enterprise packages/features are commercially licensed. TypeScript integration framework ("Pieces") with workflow automation, branching/retries, versioning and integrations that can be exposed as MCP tools. The project advertises hundreds of integrations; confirm each connector's current status, permissions and licence individually.

**AEGIS decision:** High-priority connector-catalogue and workflow UX reference; possible optional adapter. Evaluate individual pieces as connector candidates rather than installing the whole platform. Build AEGIS-native capability manifests with explicit scopes, read/write classification, schemas, rate limits and approval policies. A connector's presence in Activepieces must never grant it permission in AEGIS. Keep enterprise-only features separate and review connector-specific third-party licences and data handling.

### Temporal

Primary candidate: https://github.com/temporalio/temporal. Temporal server repository reports MIT licence. Mature durable-execution platform: workflow state survives process failures, with retryable activities and replayable workflow orchestration. It is a server platform with workers and persistence, not a small library or a Cloudflare Worker drop-in.

**AEGIS decision:** Top-tier durability architecture reference and long-term candidate. Study workflow history, deterministic orchestration, activity retry, cancellation, signals, timers, versioning and recovery semantics. Do not add a Temporal cluster to the current low-cost Cloudflare setup: it introduces a separately operated server, persistence and worker fleet. Continue the minimal AEGIS D1/Queue runtime for the first health-check slice. Reassess Temporal only when multi-step jobs justify the operational footprint.

### Hatchet

Primary candidate: https://github.com/hatchet-dev/hatchet. Repository reports MIT licence. Orchestrates background tasks, AI agents and durable workflows across TypeScript, Python, Go and Ruby; includes retries, schedules, event/webhook triggers, concurrency controls, task routing and observability. Self-hosted operation requires a separate service and infrastructure (including Docker for the documented local path).

**AEGIS decision:** High-priority comparison candidate for the next runtime stage. Compare worker model, durable sleep/event waits, retries, concurrency and operational footprint against the existing AEGIS Worker/D1/Queue implementation and Temporal. Do not run Hatchet and a full AEGIS scheduler/queue in parallel for the same jobs. If adopted, one engine owns execution state; AEGIS remains the identity, policy, approval and user-facing control plane. Run a small proof of concept only after defining resource limits, backup/restore, security boundaries and migration/exit strategy.

### Trigger.dev

Primary candidate: https://github.com/triggerdotdev/trigger.dev. Repository reports Apache-2.0. TypeScript-first durable background jobs and AI workflows with retries, queues, idempotency, long-running execution, schedules, observability and progress streaming. Supports managed cloud and self-hosted Docker/Kubernetes deployments. Self-hosting the full stack is operationally heavier than deploying one Cloudflare Worker; review the exact current compose/Helm footprint before estimating costs.

**AEGIS decision:** High-priority developer-experience and TypeScript workflow reference; optional future runtime alternative. Study checkpointing, retries, idempotency, run traces, progress streaming and human-wait patterns. Its TypeScript orientation may fit AEGIS better than Python-first systems, but do not assume its runtime fits Cloudflare Workers or a free Chromebook-only setup. Compare with Hatchet and Temporal using the same representative AEGIS jobs before selecting any engine.

### Inngest — provisional interpretation of user's "ingest"

Primary candidate: https://github.com/inngest/inngest. The server/CLI licensing is described by its repository as Server Side Public License with delayed open-source publication under Apache-2.0; SDKs are Apache-2.0. Verify exact component and release terms. Durable event-driven functions combine triggers, cron schedules, retries, step state and coordination. Supports self-hosted server and hosted platform.

**AEGIS decision:** Study event-driven function and developer-experience patterns; defer server adoption. Do not describe the whole server as OSI-open-source or copy server code without checking SSPL/DOSP terms. Evaluate SDK/API integration separately from server licensing. Compare it with Trigger.dev, Hatchet and the native AEGIS runtime before adding another scheduler/queue. The user's spelling "ingest" has been interpreted as Inngest; confirm if a different product was intended.

### Kestra

Primary candidate: https://github.com/kestra-io/kestra. Apache-2.0. Declarative YAML, event-driven orchestration for data, infrastructure, business processes and AI agents; has MCP support and Python/JavaScript SDKs. Official requirements describe a Java runtime, PostgreSQL or MySQL for OSS queue/repository, and at least 4 GiB RAM plus 2 vCPUs for a standalone server. Script tasks may require Docker-in-Docker.

**AEGIS decision:** Architecture reference for declarative workflows, event triggers, versioning and data pipelines; not a current deployment candidate. Infrastructure footprint is disproportionate to the current free-tier Cloudflare-first build. Revisit only if AEGIS develops substantial multi-source ETL or scheduled data operations that cannot be handled by small isolated jobs.

### Windmill

Primary candidate: https://github.com/windmill-labs/windmill. Core Community Edition is AGPLv3; APIs/OpenAPI clients and some components have separate licences. Commercial licensing applies to certain embedding, managed-service and redistribution scenarios. Code-first scripts, workflows, apps and AI agents; supports many languages, Git sync, worker isolation and environment promotion.

**AEGIS decision:** Study worker isolation, code-first workflow composition and review/promotion patterns; do not embed the platform. AGPL and commercial-use boundaries need careful review before any distribution or user-facing integration. Its PostgreSQL/worker deployment footprint is heavier than the initial AEGIS runtime. Do not create a second workflow control plane just to gain a visual editor.

### Apache Airflow

Primary candidate: https://github.com/apache/airflow. Apache-2.0. Programmatic DAG authoring, scheduling and monitoring for data pipelines. Its own README says it is best for workflows whose DAG structure is mostly static and slowly changing.

**AEGIS decision:** Reference-only for future bulk data engineering/ETL, not interactive agent jobs. Airflow is designed around a scheduler, metadata database, executor and workers; it is operationally excessive for the current small event-driven runtime. Do not use it for user-facing, approval-driven agent conversations or low-latency tasks. If AEGIS later needs large scheduled data pipelines, compare it with Kestra and managed data services.

### OpenOutreach

Primary candidate: https://github.com/eracle/OpenOutreach. Repository reports GPL-3.0. Self-hosted B2B lead discovery/qualification and email outreach agent. It uses a licensed data provider and can send email through a connected mailbox; some operations consume paid credits.

**AEGIS decision:** Not a core AEGIS capability. This is a specialised sales/outbound lead-generation workflow. Study only its modular CLI producer/consumer contract, transparent qualification rationale and spend gates if AEGIS later gains a user-requested outreach module. Never enable mailbox sending, purchase lead credits or contact third parties by default. Require explicit per-campaign approval, recipient/source provenance, opt-out/suppression checks and applicable UK GDPR/PECR compliance review. GPL-3.0 and data-provider terms require review before reuse. No outbound messaging capability is authorised by this entry.

## Workflow-engine selection guidance

These products overlap, but are not interchangeable:

| Candidate | Best-fit problem | AEGIS position |
|---|---|---|
| Existing AEGIS Worker + D1 + Queue | Small, bounded jobs on Cloudflare | Keep as first runtime slice |
| Temporal | Mature durable, multi-step execution | Benchmark/reference; future option |
| Hatchet | Agent/background tasks, retries and concurrency | Closest runtime comparison |
| Trigger.dev | TypeScript developer experience and long-running AI jobs | Strong alternative to benchmark |
| Inngest | Event-driven durable functions | SDK/pattern study; server licence review |
| Kestra | Declarative business/data workflows | Later data-orchestration option |
| Airflow | Scheduled DAG/data engineering pipelines | Not agent runtime |
| Activepieces / n8n / Windmill | Visual or code-first integrations and automation | Optional external automation layer; licensing matters |

**Architecture rule:** AEGIS must retain one canonical job identity, state machine, policy engine, approval record and audit trail. An external workflow engine may execute work behind an adapter, but must not create a second conflicting source of truth. Do not deploy multiple overlapping engines before a benchmark proves the need.

## Source-intake clarifications

- "Ingest" was interpreted as Inngest.
- "Open Outreach" was interpreted as eracle/OpenOutreach.
- "OpenDots" was interpreted as CopilotKit/OpenDots.
- No code, package, connector, account or service from this list has been installed or authorised.

## Research intake — agent routing, API tooling, UI and model frameworks (15 November 2026)

### Agent Lightning — Microsoft
Source: https://github.com/microsoft/agent-lightning — MIT. Current v1.0 is a reinforcement-learning training framework, not a general-purpose autonomous agent runtime. It uses a model API gateway, rollout controller, trainer, VERL/vLLM and Kubernetes jobs; Python 3.12+ and a substantial GPU-oriented training stack are expected. Upstream benchmark claims have not been independently reproduced by AEGIS.

**AEGIS decision:** High-value future Agent Evaluation & Learning Lab reference, not a production runtime dependency. Reverse-engineer trajectory capture, rollout IDs, reward/evaluation contracts, training-data provenance and separation of trainer/controller/gateway. First implement deterministic AEGIS trace capture and offline evaluation; consider RL only with a real benchmark, suitable GPU budget and safe reproducible dataset. No GPU training, Kubernetes or package installation now.

### ToGO / ai-agno
Source: https://github.com/togo-framework/ai-agno — MIT. This is a Go framework integration that calls an Agno agent sidecar over HTTP (POST /run); it is not the Agno agent runtime itself.

**AEGIS decision:** Low priority. The sidecar adapter contract is a useful interoperability pattern, but Go + Agno is not aligned with the current Cloudflare Workers / JavaScript core. Reproduce only the provider-neutral remote-agent adapter contract if a future external agent host is approved. No code imported.

### Harness Router
Source: https://github.com/Protocol-Lattice/harness-router — MIT; Python 3.11+; upstream labels it alpha. It selects the next tool from a goal, current observation and tool descriptions, with confidence/fallback, cached decisions and optional MCTS. The host harness still supplies arguments, enforces permissions, executes the tool and processes results. Default decision provider is Jev through OpenRouter.

**AEGIS decision:** High-priority design reference for a bounded tool-selection subcomponent. Build an AEGIS-native router that emits only a proposed capability/action ID, confidence and rationale; the existing AEGIS policy evaluator remains authoritative and executes after exact-operation approval. Low confidence, stale context, unknown tool, or policy mismatch must return control to the planner. Never let an LLM router grant permissions or construct executable commands. Avoid requiring OpenRouter/Jev; route through AEGIS provider adapters and budget controls. No dependency or API key configured.

### Grok / xAI
Source: https://docs.x.ai/ — commercial model/API provider, not an open-source agent framework. Treat as an optional model-provider adapter, with API usage billed separately from a ChatGPT subscription.

**AEGIS decision:** Add only through the existing provider interface after recording model ID, pricing, rate limits, retention/data-use terms, region, tool-call support and failure behavior. Never hard-code a Grok-specific assumption into orchestration or store provider credentials in browser code. No xAI account, key or connection created.

### Hoppscotch
Source: https://github.com/hoppscotch/hoppscotch — MIT. Broad API-development ecosystem with HTTP request builder, environments, auth helpers, GraphQL, WebSocket, SSE, Socket.IO and MQTT; PWA support. The upstream repository is a substantial pnpm monorepo and service ecosystem.

**AEGIS decision:** High-value QA/Developer Console reference, not a full application dependency. Build a compact AEGIS-native API inspector around our own routes: request method/path, safe headers/body, response status/headers/body, latency, saved non-secret examples and redacted environment variables. Default to local AEGIS endpoints and read-only tests; writes require the same approvals as any other capability. Never persist bearer tokens, cookies or secrets in saved collections. No Hoppscotch code installed.

### JSON Crack
Source: https://github.com/AykutSarac/jsoncrack.com (the older VS Code repository says it has moved into this monorepo). The core concept is interactive JSON-to-node-graph visualization. The older VS Code package points at a newer canonical repository; a current root-level licence for the moved code was not verified in this intake.

**AEGIS decision:** Strong product idea for a native JSON/schema/agent-trace visualizer, especially for inspecting tool manifests, workflow graphs, memory relations and API payloads. Build our own visualizer after verifying the current app source and applicable licence; do not copy code from the archived VS Code repository. No code installed.

### Cult UI
Source: https://github.com/nolly-studio/cult-ui and documentation https://www.cult-ui.com/docs. Registry of accessible, animated React/Tailwind components distributed as copyable source through shadcn CLI. Documentation describes Tailwind CSS v4, React and motion dependencies. A similarly named repository exists; do not confuse them. The canonical registry's precise licence file should be rechecked before source reuse; a similarly named shadcn/cult-ui repository points to a different MIT source.

**AEGIS decision:** UI inspiration only until the canonical registry licence is independently verified. Adapt interaction ideas (command input, agent status, approval cards, responsive panels) to the existing AEGIS stack and accessibility requirements; avoid introducing React/Tailwind v4 solely for a component. Respect reduced-motion preferences. No components copied or installed.

### Open WebUI
Source: https://github.com/open-webui/open-webui — current post-v0.6.6 licence adds a branding-protection condition and is not OSI-approved open source. The project is a feature-rich self-hosted Python/Svelte AI interface, with model-provider connections, tools, documents/RAG and local-model support. It is a substantial server application, not a Cloudflare Pages/Workers module.

**AEGIS decision:** Do not fork, embed or white-label. Its licence requires the Open WebUI identity to remain visible except for stated exceptions (including deployments of 50 or fewer users); that conflicts with AEGIS being its own product identity. Study generic interaction patterns only and independently implement a native AEGIS workspace. The upstream UI/server stack is too heavy for the current free-tier target. No code installed.

### LangChain.js
Source: https://github.com/langchain-ai/langchainjs — MIT. Broad TypeScript framework for model/provider integrations, chains, tools, retrievers and agent abstractions; large and integration-rich, with transitive dependency and runtime-compatibility implications.

**AEGIS decision:** High-value integration catalogue and interface reference, but do not make core orchestration dependent on LangChain. Keep AEGIS-owned canonical agent, job, policy, memory and approval schemas. Add narrow, separately versioned provider/retriever adapters only where tests demonstrate value and Cloudflare Worker compatibility. No package installed.

### LlamaIndex
Sources: https://github.com/run-llama/llama_index (Python, MIT) and https://github.com/run-llama/LlamaIndexTS (MIT, explicitly deprecated). The Python project is the maintained data/RAG framework candidate; the TypeScript repository's own README states it is deprecated and no longer maintained.

**AEGIS decision:** Do not adopt LlamaIndexTS. Study the maintained Python project's document ingestion, node/chunk metadata, retrieval, citation and index abstractions for a future isolated ingestion service. AEGIS remains canonical for source provenance, permissions, retention and prompt-injection controls. Prefer a small native retrieval contract in the current JS core before considering a separate Python service. No package installed.

### Hugging Face Transformers
Source: https://github.com/huggingface/transformers — Apache-2.0 library for model definitions, training and inference across a very large model ecosystem. Python/PyTorch and model-specific hardware/dependency requirements make it unsuitable as a browser/Cloudflare Worker dependency. Individual model repositories may have their own licences and usage restrictions.

**AEGIS decision:** Future model evaluation/hosting reference only. AEGIS should use remote provider adapters initially; a separate, explicitly provisioned model host may later expose a narrow OpenAI-compatible endpoint. Record model licence, weights provenance, hardware, memory, context length, quantisation and benchmark evidence per model. No local model download or inference host created.

### vLLM
Source: https://github.com/vllm-project/vllm — Apache-2.0 inference/serving engine with GPU and selected CPU/Apple Silicon hardware paths. It is a model-serving component, not an orchestration framework; production use needs compatible hardware, memory, deployment and operations.

**AEGIS decision:** Future external inference-provider adapter, not a current Cloudflare/Chromebook deployment. Benchmark only if a dedicated capable host becomes available and total power/hosting costs beat managed APIs. Keep endpoint, model, authentication and budget behind the AEGIS provider interface. No installation or host provisioned.

### CyberDrop-DL (possible interpretation of 'Cyberdrop-d1')
Candidate found: https://github.com/Cyberdrop-DL/cyberdrop-dl — GPL-3.0-only Python bulk downloader for multiple third-party file hosts; Python 3.12+ and a sizeable asynchronous downloader stack. This is not Cloudflare D1 and is unrelated to the AEGIS database layer.

**AEGIS decision:** Not a core AEGIS dependency. Do not add a bulk third-party-host downloader without a clearly defined, lawful user-owned media ingestion need, host terms review, provenance, malware scanning, storage limits and explicit download approval. GPL-3.0-only is incompatible with casual code copying into the proprietary AEGIS application. The user's exact intended source remains unconfirmed; this candidate is only a likely spelling correction.

## Implementation priorities from this intake

1. Keep the newly implemented AEGIS project-space and event timeline as the canonical project/workboard layer; do not add another project-management or job database.
2. Add a constrained native tool-selection proposal stage inspired by Harness Router, always subordinate to AEGIS policy and approvals.
3. Add a native API inspector and JSON/schema/trace visualizer for engineering QA.
4. Build trace capture and evaluation before any reinforcement-learning/training infrastructure.
5. Keep LangChain, LlamaIndex, Transformers and vLLM behind optional adapters or separate services; do not burden the Worker/PWA core with their dependencies.
6. Treat Grok as an optional provider, not an architectural dependency.
7. Preserve explicit licence, provenance, security and 'not installed/not connected' records. No source code or third-party service from this intake has been installed, connected or deployed.


### OpenMuse — CopilotKit
Source: https://github.com/CopilotKit/openmuse — MIT according to the upstream project description. OpenMuse is an alpha personal-agent application built with CopilotKit and AG-UI, with React Native clients for iOS, Android and web. Its architecture includes a server, task worker and browser worker; a persistent Chromium browser profile and optional isolated Linux workspace; browser, terminal, file and PDF workflows; visible plans, streamed agent events, delegated tasks and a takeover console. It is intended as a self-hostable template compatible with different agent harnesses, not a complete turnkey always-on hosted service. Open-ended reasoning and certain Google-account integrations require separate configuration.

**AEGIS decision:** Very high-value mobile-first agent-workspace and human-supervision reference. Reverse-engineer its visible task lifecycle, streamed AG-UI event model, agent-computer takeover, persistent browser profile, task queue and mobile interaction. Implement equivalent AEGIS-native clients and adapters rather than adopting its full application stack. AEGIS remains authoritative for identity, memory, capability manifests, exact-operation approvals, job state, secrets and audit. Treat browser, terminal, files and account integrations as high-risk capabilities: isolate execution, enforce per-action scopes, redact secrets, log receipts, require approvals for external writes and destructive actions, and provide immediate stop/revoke. Verify actual container isolation and network egress before any execution; a visible terminal or browser is not itself a security boundary. No OpenMuse code, container, agent computer or connector has been installed or deployed.

### Open WebUI — separate project
Source: https://github.com/open-webui/open-webui. This is a distinct self-hosted AI chat/model interface supporting multiple model backends and tools; it is not OpenMuse. Its current post-v0.6.6 licence includes mandatory preservation of Open WebUI branding except under its stated exceptions, and the current licence page explains that this is not OSI-approved open source. Earlier contributions through v0.6.5 retain BSD-3 terms. 

**AEGIS decision:** Study its model selection, chat UX, knowledge/document workflows and administration as product references. Do not adopt it as AEGIS's branded front end or remove its identity under the current licence. Build an independent AEGIS interface and provider abstraction. If running Open WebUI separately for personal experimentation, retain its branding and review its current licence and deployment security. No Open WebUI code, service or connector has been installed or deployed.


### OpenMuse (OpenMuseAgent) — corrected identification
Original repository: https://github.com/OpenMuseAgent/OpenMuse. Its README explicitly says the project moved to **nanoMuse** at https://github.com/nano-muse/nanoMuse; the old OpenMuse repository is an archive of versions 0.1.0–0.6.0 and is no longer maintained. The current nanoMuse repository identifies itself as a cross-device personal agent (phone, desktop, web console and relay), with a local/hostable runtime, model-provider catalogue, MCP, scheduled goals, persistent memory, credential vault and a separate Sentinel gatekeeper. It supports Android and desktop/browser interfaces, device GUI interaction and ongoing work while the app is closed. The current repository's LICENSE and package metadata identify GPL-3.0-or-later (Python >=3.11); the archived OpenMuse repo was MIT at its archived 0.6.0 release. Do not assume the archived MIT licence applies to the current nanoMuse codebase.

**High-value AEGIS reference.** Reverse-engineer the architecture, not the code:
- Sentinel as a mandatory mediation boundary between model and tool execution.
- Risk classification, policy decisions, exact-operation approvals, deny paths and revocation.
- Credential vault with late-bound secret resolution and redacted tool results.
- Taint tracking for private-data reads and outbound egress.
- Isolated shell/Python execution with scrubbed environments and explicit writable workspace boundaries.
- Durable goal scheduling, event triggers, task budgets, activity feed and resumable work.
- Shared UI protocol so web, terminal and phone clients render the same approval, tool and activity events.
- Cross-device agent runtime and user-controlled device actions.

**Fit and limits.** Conceptually very close to the AEGIS mission and especially useful for validating the Sentinel/Capability System and long-running personal-agent experience. However, it is a Python 3.11+ runtime with a sizeable dependency set, local process/sandbox assumptions (Linux bubblewrap in particular), device apps and its own data/runtime architecture. It is not a drop-in Cloudflare Worker or browser-only service. AEGIS must keep its own canonical job IDs/state, capability registry, exact-operation approval records, encrypted secret lifecycle, project memory and audit. Device/desktop execution should be a separately isolated adapter with explicit device consent; do not expose a shell or general computer-control capability through the Cloudflare Worker.

**Licence decision.** GPL-3.0-or-later is strong copyleft. Do not copy or incorporate nanoMuse code into AEGIS's current codebase without an explicit licensing decision and review of distribution/network-service obligations. Use the architectural concepts as independent design input, preserve source attribution in this register, and build an independently implemented AEGIS-native Sentinel and durable-goal layer. The old OpenMuse archive's MIT licence applies to that archived code only; it does not make the current nanoMuse repository MIT. No nanoMuse/OpenMuse package, code, Android app, Docker image, local daemon, credentials or external connector has been installed or connected.

### Open WebUI — retained as a separate candidate
Source: https://github.com/open-webui/open-webui. This is a distinct self-hosted AI chat/workspace product, not OpenMuse/nanoMuse. It remains recorded above as a UI/model/RAG reference only. Its current branding-protection licence condition means AEGIS should not fork, embed or white-label it; independently reproduce generic workspace patterns instead. No Open WebUI code or service is installed or connected.

## Locally Uncensored — local AI studio architecture reference (15 November 2026)

Source: https://github.com/PurpleDoubleD/locally-uncensored — AGPL-3.0. The project is a Tauri v2 / React / TypeScript desktop AI studio combining local and optional cloud model providers, coding-agent workflows, MCP/tool use, image/video generation through ComfyUI, RAG, voice and opt-in remote phone access. The repository README currently describes Windows and Linux as supported desktop platforms, with macOS still on the roadmap; the project has also published an Android client in release notes. It is not a browser-native PWA or a drop-in Cloudflare Worker runtime. The upstream README and package metadata identify AGPL-3.0; no code or substantial text is copied here.

**AEGIS decision:** High-value reverse-engineering reference for local model/provider adapters, local-vs-cloud mode separation, model/hardware preflight, project-scoped coding-agent workspaces, review-before-apply diffs, tool permission controls, MCP discovery, local media pipelines and opt-in remote-device pairing. AEGIS should independently implement portable contracts and browser-first UX, keeping its own Sentinel, capability registry, exact-operation approvals, project memory and audit authoritative. Do not embed, fork or copy AGPL code without a deliberate licence decision. Local execution requires compatible user hardware and is not automatically available on Chromebook/iOS; investigate Android/remote access separately. No app, model, code, package, backend, account or connector has been installed or connected.

## Developer ecosystem intelligence sources — 15 November 2026

### Awesome MCP Servers — discovery index
Source: https://github.com/punkpeye/awesome-mcp-servers (MIT for the directory repository). The project is a large community index of MCP servers. It is a discovery catalogue, not a security certification. Each listed server has its own repository, licence, maintainer, dependency chain, hosting model, permissions and threat surface; the directory's MIT licence does not relicense those projects.

**AEGIS decision:** High-priority Forge discovery input. Build a native MCP catalogue with normalized records for source URL, publisher, licence, last commit/release, supported transport, auth model, tool/resource/prompt inventory, declared read/write/destructive effects, required scopes, network destinations, secrets, platform/runtime requirements, maintenance status, advisories, test evidence and AEGIS risk decision. Fetch and inspect upstream source before recommending connection. A listing or MCP readOnlyHint is never an authorization grant. No servers installed or connected from the list.

### free-for.dev — free-tier discovery
Source: https://github.com/ripienaar/free-for-dev (README states it catalogs SaaS/PaaS/IaaS free tiers relevant to infrastructure developers; it excludes self-hosted software and expects qualifying free tiers rather than short trials). A repository LICENSE file was not found during this inspection, so do not assume the README content is reusable under an open licence.

**AEGIS decision:** High-priority cost intelligence source, not a source of truth. Build a native Free-Tier Ledger with provider, service, category, allowance, duration, card requirement, commercial-use eligibility, overage behaviour, region, quotas, last verified date, official pricing/terms URL and confidence. Treat all offers as volatile; recheck official provider terms before provisioning. Add budget ceilings and stop-before-paid-overage defaults. Never create accounts, consume credits or provision resources automatically based on a directory entry.

### Build Your Own X — reverse-engineering curriculum
Source: https://github.com/codecrafters-io/build-your-own-x. The README identifies the collection as CC0/public-domain-dedicated to the extent possible. It indexes tutorials for recreating operating systems, databases, compilers, browsers, shells, web servers, LLMs, RAG and other technologies. Individual tutorials may have separate authors and terms; check each linked work independently.

**AEGIS decision:** Very high-priority Forge learning and reverse-engineering reference. Use it to identify foundational concepts and build small AEGIS-native prototypes with explicit scope, threat model, tests and performance criteria. For AEGIS OS, focus on an application-level agent operating environment (scheduler, process/task isolation, capability permissions, filesystem abstraction, IPC/event bus, UI shell and recovery), not a replacement kernel or desktop OS. For model work, prefer evaluation, routing, prompt/context pipelines and small educational implementations before attempting expensive training. No tutorial code copied or installed.

### Cross-source operating rule
These directories help discover and learn; they do not approve dependencies. Every candidate must pass provenance, licence, maintenance, security, platform, cost and test review. AEGIS should extract ideas, build its own adapters and native components, and keep Sentinel as the enforcement boundary.


## Persistent memory, local inference and computer-use agents

These are three distinct source tracks, not interchangeable products.

### Kytheros Strata — persistent memory architecture

- Source: https://github.com/kytheros/strata
- Reported licence: Apache-2.0; verify the pinned commit and bundled dependency licences before any code reuse.
- Relevant ideas: SQLite/FTS5 local-first retrieval, Cloudflare Workers/D1 adapter, typed memories, provenance, hybrid retrieval and memory quality gates.
- AEGIS decision: high-priority architecture reference. Rebuild selected concepts in the native memory substrate; keep AEGIS owner/project identity, Sentinel policy, storage schema and audit authoritative.
- Security caveat: a caller-supplied identity header is not authentication. Any multi-tenant HTTP deployment needs a verified authentication boundary. Do not expose a raw memory service publicly.

### Niko1221 Strata — optional local inference engine

- Source: https://github.com/Niko1221/Strata
- Reported licence: MIT; verify the exact release and bundled model/runtime licences independently.
- Relevant ideas: local model serving and OpenAI/Anthropic-compatible provider interfaces.
- AEGIS decision: optional future local-model provider adapter for capable hardware. It is not the Kytheros memory project and is not suitable as a required runtime for the current Chromebook/iPhone/iPad-first target. Do not require GPU hardware or local model downloads for the first release.

### Meet Nod — computer-use architecture

- Source: https://github.com/n8n-io/nod
- Official product overview: https://blog.n8n.io/meet-nod/
- Documentation: https://nod.n8n.io/docs/
- Reported licence: Apache-2.0; pin and inspect exact source and third-party components before reuse.
- Relevant ideas: isolated browser/workspace, user approval for consequential actions, credential isolation, action audit, budgets and scheduled work.
- AEGIS decision: high-priority architecture reference, not a direct runtime dependency. Build a provider-neutral computer-use capability with a separately isolated worker, Sentinel mediation, scoped vault references, explicit approvals, redacted audit, time/cost limits and durable server-side jobs.
- Platform caveat: a desktop-hosted agent does not itself deliver Chromebook/iOS-native operation or always-on execution when its host sleeps. AEGIS's browser-first control plane and server-side job runtime remain canonical.
- Security boundary: never expose unrestricted browser, shell, filesystem or host-control tools to an agent. Retrieved page content and browser output are untrusted data, not instructions.

### Native implementation status

- PR #27: https://github.com/LAURENCE1977/Aegis-/pull/27 — open, draft, unmerged; stacked on PR #26.
- AEGIS-native memory validation, D1 repository, authenticated APIs, owner review queue, append-only D1 lifecycle audit triggers, history endpoint, chat retrieval and mobile review UI are implemented on `feature/native-memory-substrate`.
- Canonical ordered shared D1 migrations: `migrations/shared/0001_project_spaces.sql`, `0002_memories.sql`, `0003_memory_lifecycle_audit.sql`. Do not independently apply nested workspace/memory feature-source copies to the same database.
- Chat retrieves only accepted, unexpired, non-restricted personal memories; owner/project scope is applied in SQL. Retrieved memory is bounded JSON reference data, never tool instructions.
- Latest fully verified test run at commit `b02f4f5fa3d8841c6eee58246e7bdcbf35e6fe7b`: **194 passed, 0 failed**. Later frontend smoke-test and documentation commits require another CI run.
- Cloudflare Pages preview build succeeded for the earlier verified memory UI commit. Production is unchanged.
- D1 has not been provisioned or bound, migrations have not been applied to the user's Cloudflare account, and no memory data has been persisted in production.
- No external source package, daemon, model, browser agent, account or credential has been installed or connected.


## Agent UI, streaming and human-in-the-loop

### CopilotKit and AG-UI

- Source: https://github.com/CopilotKit/CopilotKit
- Official site/docs: https://copilotkit.org/ and https://docs.copilotkit.ai/
- Protocol: https://github.com/ag-ui-protocol/ag-ui
- Reported licence: MIT for the CopilotKit repository; inspect pinned packages and dependencies before reuse.
- Relevant ideas: chat UI, streaming agent progress, frontend tools, shared agent/application state, generative UI, human-in-the-loop pauses and an event-based Agent–User Interaction protocol.
- AEGIS decision: high-priority architecture reference. Build a small native AG-UI-compatible transport and event adapter so the current PWA, future React/mobile clients and other agent surfaces share one backend contract. Keep AEGIS's own provider, memory, job, capability, Sentinel, approval, vault and audit systems authoritative.
- Stack fit: CopilotKit's TypeScript runtime documents Cloudflare Workers support, but the current AEGIS frontend is static HTML/CSS/JS with no React build system or package manifest on this feature branch. Do not migrate to React or add packages just to adopt the UI. Prove a minimal native protocol endpoint first; compare a thin CopilotKit client later.
- Security: AG-UI events and frontend tool calls are not permissions. Authenticate streams; bind run IDs to the owner; redact secrets; persist canonical job state; route every proposed action through Sentinel; bind approvals to exact action and payload digest; render only registered UI components; reject arbitrary generated HTML/JS and untrusted tool instructions.
- AEGIS-native AG-UI 1.0 text-run primitives and authenticated `POST /api/ag-ui` are now implemented; only text chat lifecycle is supported, and frontend tools/context/resume/multimodal payloads fail closed.
- GitHub Actions run 43742924570: 210 passed, 0 failed on `370cc052c2224d8e1a15393a542621e80fe0c125`.
- No CopilotKit package, React migration, service, account or upstream code has been installed or connected.
- Detailed architecture and implementation boundary: [AEGIS CopilotKit and AG-UI boundary](AEGIS_COPILOTKIT_AGUI.md).
