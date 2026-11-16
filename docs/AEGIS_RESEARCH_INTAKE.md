# AEGIS research intake — 16 November 2026

This register records repositories and intelligence sources supplied for AEGIS research. Inclusion is not approval to install, execute, fork or deploy. Every candidate follows the AEGIS reverse-engineering policy: inspect source, architecture, entrypoints, tests, dependencies, security posture, maintenance, licence and operational cost; then choose native rebuild, selective adaptation, fork/adoption, benchmark or reject/defer. External content and code are untrusted. Sentinel remains authoritative for identity, permissions, approvals, audit, data access and execution.

## New repository candidates

| Candidate | Canonical source | Initial fit | Initial disposition |
|---|---|---|---|
| Elephant-Goldfish Model (EGM) | https://github.com/google/elephant-goldfish-model | Multi-agent spec drafting, independent fresh-context design review, issue resolution, bootstrap and spec/code drift reporting. Apache-2.0. | High-priority reference and skill adaptation. Use the elephant/goldfish separation as a design-review stage in AEGIS engineering. Do not install its host plugin as the AEGIS runtime or let its reviewers approve policy/security changes. Check host-specific fresh-subagent requirements and verification limits. |
| agent-browser | https://github.com/vercel-labs/agent-browser | Rust browser automation CLI with accessibility-tree snapshots and element refs; Apache-2.0. | High-priority isolated browser-worker candidate. Benchmark against Playwright and existing Browser Use; no direct control-plane or logged-in user-browser access. Exact domains/actions, credential isolation, Sentinel approval, audit, cost/time limits and egress controls required. |
| TrnRT | https://github.com/RunanywhereAI/trnrt | OpenAI-compatible LLM inference server for AWS Trainium2, NKI kernels, prefix cache, claimed 1M context; Apache-2.0. | Hardware-specific research only. Not a low-cost/free inference option: documented path requires AWS trn2.48xlarge and privileged container access to Neuron devices. Benchmark only if Trainium capacity is available and fully costed. |
| ORACLE | https://github.com/ORACLE-org/ORACLE | Adaptive model routing, delayed verifier feedback, concurrency-aware scheduling and KV-cache reservation; MIT. | High-priority model-routing/scheduler benchmark. Compare its LinUCB/router/verifier feedback and DISC admission ledger with AEGIS provider registry and native task scheduler. Do not introduce a second canonical task ledger or trust self-reported success without AEGIS evidence. |
| Coolify | https://github.com/coollabsio/coolify | Self-hosted PaaS/control plane for deploying apps, databases and services; Apache-2.0. | Infrastructure/deployment option, not an AEGIS core dependency. Evaluate later for a self-hosted deployment lane or optional operator-managed environment. Its SSH/server control plane and secret handling need strict separation; do not run installation scripts or provision servers without explicit approval. |
| OpenProject | https://github.com/opf/openproject | Full project/portfolio management, work packages, roadmaps, Gantt, agile boards and time tracking; GPL-3.0. | Study API/integration and workflow concepts. Do not copy source into AEGIS without a deliberate GPL compliance decision; likely connector or independent native workflow implementation. |
| rederive | https://github.com/EricJujianZou/rederive | Socratic skill for learning codebases by deriving design decisions from first principles; repository reports Python and is intended for multiple coding-agent harnesses. | Adapt the teaching/reverse-engineering method into AEGIS repo-inspection and learning workflows. Verify exact licence and current commit before reuse. |
| Kiri — likely container-runtime candidate; confirm | https://github.com/libracoder/kiri | Rust container runtime for macOS/Windows/Linux, Docker API/CLI and Compose compatibility, small Linux VM, containers and lightweight Kubernetes/machines; Apache-2.0. | High-priority isolated agent-computer/runtime benchmark, subject to security review. It is not an agent framework. Guest Linux kernel is GPL-2.0 and Kiri name/logo are excluded from Apache licence; forks must use another name/logo. Need inspect daemon socket, VM boundary, privileged container handling, image provenance, auto-update/signatures, host networking and escape protections before adoption. Other namesakes include yuxino/Kiri (local capture/OCR), Yeshwanthyk/kiri (agent control plane), david-d25/kiri (Telegram agent), and kiri.build (local AI workspace). |
| Hex Brain — unresolved identity | Not yet identified | Search did not establish a canonical repository. Possible confusion with similarly named memory projects is not enough to select one. | Hold for exact repository URL or owner/name. |
| Oracle — additional namesake unresolved | Possible alternatives include https://github.com/oracle/locus and https://github.com/steipete/oracle | Oracle Locus is an OCI-centric agent harness with admission gate, multi-agent patterns, memory/RAG and sandbox; steipete/oracle is a local multi-model second-opinion CLI/MCP. | ORACLE-org/ORACLE is the strongest match for AEGIS routing. Keep these as separate candidates only if user intended them. |

## Standing AI intelligence source: TLDR AI

Primary source: https://tldr.tech/ai/archives
RSS: https://tldr.tech/api/rss/ai
Subscribe/info: https://tldr.tech/ai

Treat TLDR AI as a recurring discovery feed for AI-related developments: model and inference releases, agent systems, open-source repos, developer tooling, research, infrastructure, security, business/funding/mergers and material platform changes. Follow original links for consequential claims. Classify each item by AEGIS relevance, evidence, maturity, licence, security implications, real costs and whether it changes a current architectural decision. Distinguish confirmed facts from newsletter framing, vendor claims and speculation. Avoid adding every mentioned tool; promote only items with a concrete use case and comparative advantage.

Initial archive check (16 Nov 2026): archive lists issues through 13 Nov 2026. The newsletter is a useful discovery index, not an authoritative source of truth; verify important stories against primary sources.

## Research order

1. EGM and rederive — strengthen AEGIS's own spec-first, independent review, reverse-engineering and learning workflow.
2. agent-browser — assess isolated computer/browser worker against existing Playwright and Browser Use plans.
3. ORACLE-org/ORACLE — benchmark adaptive model selection and concurrency-aware inference admission.
4. Kiri — resolve intended repository, then compare local workspace, agent-control-plane and persistent autonomous-agent patterns.
5. Coolify — deployment portability and operational cost comparison; no deployment action.
6. TrnRT — record hardware/cost prerequisites; do not prioritize absent Trainium hardware.
7. OpenProject — inspect API/data model only if AEGIS needs project-management interoperability.
8. Hex Brain and other Oracle namesakes — await canonical identification.

## Source notes

- EGM README/release: https://github.com/google/elephant-goldfish-model and https://github.com/google/elephant-goldfish-model/releases
- agent-browser README: https://github.com/vercel-labs/agent-browser
- TrnRT README/security notes: https://github.com/RunanywhereAI/trnrt and https://github.com/RunanywhereAI/trnrt/security
- ORACLE README: https://github.com/ORACLE-org/ORACLE
- Coolify README: https://github.com/coollabsio/coolify
- OpenProject README/licence: https://github.com/opf/openproject
- rederive discovery: https://github.com/EricJujianZou/rederive
- TLDR archive/RSS: https://tldr.tech/ai/archives and https://tldr.tech/api/rss/ai

Last updated: 16 November 2026. Research statuses are preliminary until source-level inspection is recorded.


## Source-level inspection updates

Inspected selected repository files on 16 November 2026; this is a targeted review, not a full security or dependency audit.

### agent-browser
- README confirms a Rust CLI daemon per browser session, Chrome DevTools Protocol control, persistent sessions, multiple browser engines/providers, accessibility-tree snapshots and element refs.
- The inspected MCP implementation exposes a broad stdio surface: navigation, click/type/fill, upload/download, screenshots/PDF, cookies/storage/network, eval, auth/session state and more. It is a powerful computer-use capability, not a safe read-only browser fetcher.
- package.json requires Node >=22 and Apache-2.0; native CLI is Rust. This is not a Cloudflare Worker dependency.
- Decision: adapt its command/snapshot model or use it as an isolated worker after capability-by-capability allowlisting. Never expose its full MCP catalogue directly to agents. Block or separately gate eval, cookies, storage, auth, upload, download, external CDP attachment, network interception and arbitrary URL navigation. Require browser sandboxing, domain allowlists, credential vault injection, download quarantine, SSRF/private-network denial, approvals for external side effects, ephemeral profiles and auditable cleanup. Compare against Playwright and Browser Use before choosing.

### Elephant-Goldfish Model
- Confirmed Apache-2.0.
- AGENTS.md explicitly disallows autonomous PR creation and demands human review/accountability; AI_POLICY.md says contributors must understand and verify changes. AEGIS will respect this if contributing upstream.
- Its architecture separates a context-holding design drafter from independent fresh-context reviewers, with brainstorm, draft, resolve, review, review-loop, bootstrap and drift-report skills.
- Decision: high-value AEGIS-native engineering workflow pattern. Rebuild orchestration and review records under AEGIS task IDs, with independent reviewer context, source citations, finding severity, deduplication, disagreement tracking and human acceptance. Reviewer output is not approval and does not replace TDD/CI/Sentinel. Verify exact runtime skill/resource manifests before copying prompt assets.

### ORACLE-org/ORACLE
- Confirmed MIT.
- The repository separates model selection/verification from scheduling. The router binds an entire multi-request program to one model, then feeds delayed verifier outcomes into selector learning. DISC keeps per-backend reservation ledgers and FIFO admission gates, with optional live capacity sources.
- Architecture is Python >=3.10 with NumPy/PyYAML; FastAPI is optional. It expects backends such as vLLM/SGLang and can accept reported task outcomes or configured verifiers.
- Decision: extract algorithms and evaluation methodology, not deploy as AEGIS's second runtime. Build native TypeScript equivalents behind AEGIS provider/task interfaces: program-level model affinity, evidence-backed outcomes, model utility/cost/latency estimates, backend capacity snapshots and admission. Never let user/agent-reported success directly train routing without independent verification and audit. Its in-memory reservation ledger is not a durable distributed lease system; AEGIS needs D1/Queue/DO coordination, leases, expiry and idempotent release.

### rederive
- Confirmed MIT.
- README describes a Socratic codebase-learning skill: background repository mapping, import and commit-history exploration, 5–10 design problems, local .rederive notes, and a no-telemetry claim.
- Decision: adapt as an optional AEGIS explain-by-derivation mode, not the default engineering mode. The normal build must still inspect source, answer directly, implement and test. Use Socratic prompts only when teaching/knowledge transfer is the goal.

### TrnRT
- Confirmed Apache-2.0, Python >=3.13, AWS Trainium2/Neuron stack and privileged Docker requirements.
- Its security documentation warns the API has no authentication and the default router binds all interfaces unless configured otherwise. Known-issues documentation discloses approximate sparse-attention selections and possible output differences; benchmarks were measured on an earlier build than current source.
- Decision: not a near-term AEGIS inference provider. No claims of cheap/free tokens: the documented path needs a trn2.48xlarge, separate compile host, hundreds of GB of model/cache storage and AWS spend. If revisited, isolate behind a private authenticated gateway, bind loopback, pin model revisions, validate outputs and repeat benchmarks on the exact release.

### Coolify
- Confirmed Apache-2.0 from composer.json; PHP/Laravel application with Docker/server orchestration and SSH-managed resources.
- README supports deployment from Git, Docker/Compose, databases and services, previews, rollbacks, domains, TLS, health checks, logs, secrets and API/CLI/MCP.
- Decision: optional self-hosted deployment/control-plane candidate, not a replacement for AEGIS's Cloudflare-first architecture today. It requires real servers and operational maintenance. Any later connector must be narrow, owner-only, exact-resource, Sentinel-gated and read-only initially. Never execute its one-line installer or provision infrastructure without approval.

### OpenProject
- Confirmed GPL-3.0 from its repository and documentation. Main stack is Ruby/Rails with PostgreSQL and extensive project-management workflows.
- Decision: API interoperability/reference only unless a deliberate GPLv3 compliance decision is made. Do not transplant code into AEGIS's independently licensed core. Compare work-package, workflow, Gantt and portfolio data concepts with AEGIS's own task/worker model before adding a connector.

### Remaining unresolved
- Kiri: three plausible but materially different projects surfaced: kiri.build (local AI workspace), Yeshwanthyk/kiri (keyboard-first local agent control plane), and david-d25/kiri (Telegram autonomous agent). Need exact intended URL before source review or adoption.
- Hex Brain: no authoritative repository identity established. Do not substitute open-brain or another memory project based on a name guess.
- Oracle: ORACLE-org/ORACLE is source-reviewed and appears the strongest match for adaptive agent model routing. Namesakes such as oracle/locus and steipete/oracle remain separate and should not be conflated.


### HexBrain — security-intelligence source
- The matching HexBrain site describes a map of publicly disclosed bug-bounty reports, vulnerability classes/weaknesses, programs, CVEs and public exploit references: https://hexbrainai.com/about.
- This is not yet a verified source repository. No canonical GitHub repository was identified during this pass.
- Decision: useful as a defensive security research index for threat taxonomy, test-case ideas and security-review coverage. Do not import exploit payloads or automatically execute tests. Every target remains subject to explicit authorisation and scope; verify CVE facts and original disclosures independently.


### Kiri — likely container runtime candidate
- Source: https://github.com/libracoder/kiri. README describes a Rust Docker-compatible runtime using a small Linux VM on macOS/Windows and the host kernel on Linux, with container lifecycle, local domains, a small Kubernetes cluster and Linux machine workspaces.
- Main workspace licence is Apache-2.0; the included guest Linux kernel is GPL-2.0 and the Kiri name/logo are explicitly excluded from the licence. Any fork must be renamed/rebranded and preserve notices/third-party terms.
- SECURITY.md identifies VM/container escape, daemon socket, HTTP/HTTPS router, DNS, CA, installer/setup and auto-update as security-sensitive surfaces. This is a real container host, not a harmless helper library.
- AEGIS fit: potentially valuable as a separate execution substrate for agent computers/workspaces on user-controlled machines or VPS nodes. Do not put it in the Cloudflare control plane or assume it works on iOS/Workers. Before use, inspect VM isolation, namespaces/cgroups, daemon auth/socket exposure, privileged containers, image trust, network isolation, host mounts, update verification, resource quotas and escape tests. Benchmark versus Docker/Podman/Firecracker and existing Cloudflare sandbox options. No install or server provisioning without explicit approval.


### agent-browser — additional security-document inspection
- Its own security guide states navigation, action and output controls are opt-in; default configuration imposes no restrictions on navigation, actions or output. Never adopt the default as an AEGIS-safe configuration.
- Domain allowlists can constrain navigations, subresources, WebSockets, EventSource and sendBeacon in supported Chromium sessions, but are not an OS/network firewall. Pair with container/host egress controls. The allowlist is incompatible with several attach/profile/restore/provider modes because those can run pages before containment is active.
- Action policy and confirmation gating can control eval, downloads and uploads; confirmation timeout is 60 seconds and non-interactive confirmation auto-denies. Credential vaulting keeps passwords out of model context, and content-boundary markers help label untrusted page content, but boundaries are defense-in-depth rather than a security boundary.
- Decision refinement: only consider a tightly configured worker with policy set before browser startup, no external CDP/profile/state restore, denied eval, narrow domain and action allowlists, OS-level network controls, isolated ephemeral browser context, and explicit confirmation for consequential actions. AEGIS Sentinel must still authorize each browser operation; upstream policy is additional defense, never authority.


## Follow-up candidate intake — 16 November 2026

This section records the next batch of projects supplied by the owner. Repository identities and selected root licences were checked against GitHub on 16 November 2026. This is a targeted intake and architecture-fit review, not a full source, dependency, threat-model or runtime audit. No candidate was installed, executed, vendored, granted credentials or connected to production.

### Candidate decisions

| Candidate / canonical source | Verified identity / licence evidence | AEGIS fit and decision |
|---|---|---|
| Edge0 — https://github.com/Edge0-AI/Edge0 | Public, active repository; root framework LICENSE is Apache-2.0. The README distinguishes framework code from model-weight and upstream model licences, and describes separate commercial restrictions for model services/assistants. | **High-priority local-inference benchmark, not an approved default.** Evaluate its native inference interface, supported platforms, memory/latency and model-specific terms against AEGIS's local-provider adapter. Treat framework, bundled third-party code, model weights, adapters and datasets as separate licence subjects. Do not assume the latest large models run on phones: platform support differs by model/engine. No model download or build until hardware and licence are checked. |
| Aider — https://github.com/Aider-AI/aider | Public, active repository. Root LICENSE path was not resolved in this check; do not rely on third-party licence labels until canonical licence evidence is obtained. | **High-priority coding-agent reference.** Study repo maps, edit workflow, Git checkpoints, lint/test loop and human-readable diffs. Do not give it direct access to AEGIS credentials or merge/release authority. Consider an isolated coding-worker adapter only after licence and tool-boundary review. |
| Claude Task Master — https://github.com/eyaltoledano/claude-task-master | Public, active repository; root licence text identifies MIT. | **Reference only for task decomposition and dependency planning.** AEGIS already owns canonical task/run state; do not add a competing task database or let an external planner approve execution. Adapt task graph concepts only where current AEGIS contracts have a demonstrated gap. |
| God's Eye View — https://github.com/Shekhar-code271/gods-eye-view | Public, active repository; root LICENSE is MIT. README describes public-data layers and explicitly warns against safety-critical or operational reliance. Third-party datasets/tiles have separate terms. | **Optional situational-awareness visualisation research.** Potential future world/events dashboard for public, source-attributed signals. No named-person search, face recognition or individual tracking. Verify every data source's licence, privacy, latency and permitted use; never use as an operational truth source. Not a core dependency. |
| OpenMAIC — https://github.com/dma000/openmaic | Public, active repository; root LICENSE is MIT. README describes a multi-agent classroom/workbench, durable sessions, material ingestion and configurable model/media/search/storage providers. | **High-value optional learning module reference.** Study course generation, interactive lessons, quizzes and session-resume patterns. AEGIS must retain learner consent, content provenance, safety, user-owned data and Sentinel authority. Audit providers and all bundled assets separately before reuse. |
| Magnitude — https://github.com/magnitudedev/magnitude | Public, active repository; root LICENSE is Apache-2.0. Project describes hardware-tuned local inference and OpenAI-compatible integration. | **High-priority local-inference benchmark alongside Edge0.** Compare supported hardware, actual model coverage, install footprint, reproducibility, thermal/memory behaviour, API compatibility and offline operation. Do not accept headline speed claims without reproducing tests on target devices. Keep it replaceable behind AEGIS's provider interface. |
| ASC — https://github.com/colosair/asc | Public, active repository; root LICENSE is ISC. README specifies Node.js 24+, local-first session contracts, write boundaries, human escalation and audit. It explicitly says it is not a sandbox and cannot constrain arbitrary same-user shell commands outside its managed executor. | **Very-high-priority architecture comparison for Sentinel and agent sessions.** Compare session contracts, immutable done criteria, write boundaries, escalation semantics and separation of permission issuance from actual execution. Rebuild/adapt concepts inside AEGIS contracts and Sentinel; do not make ASC a second policy authority. Its same-user shell limitation is a critical boundary, not a sandbox guarantee. Node 24 and local-host assumptions make direct use in the Cloudflare control plane inappropriate. |
| MiroFish — https://github.com/666ghj/MiroFish | Public, active repository; root LICENSE is AGPL-3.0. | **Research/reference only pending a deliberate AGPL compliance decision.** Multi-agent scenario simulation could inform an optional research sandbox. Do not copy, embed, network-host as an AEGIS service or combine source into the MIT core without legal review. Simulated agent outputs are hypotheses, not forecasts or validated evidence; require scenario assumptions, uncertainty and provenance. |
| Pi / pi-mono — https://github.com/pi0/pi-mono | Public, active repository; root LICENSE is MIT. Monorepo includes a unified model API, agent core, coding CLI, TUI and web UI packages. | **Very-high-priority agent-runtime reference.** Inspect package boundaries and the minimal agent loop, tool lifecycle, provider adapters, state handling, extensions and UI primitives. Prefer small AEGIS-owned adapters or selective MIT-compatible reuse over wholesale adoption. Pi must never replace Sentinel, AEGIS memory, task authority or approval state. |
| tmux — https://github.com/tmux/tmux | Canonical project identity; terminal multiplexer, separate from agent orchestration. | **Infrastructure reference only.** Useful for persistent terminal sessions on supported Linux/macOS/desktop workers. Not a browser/mobile-first UI and not a security sandbox. Any terminal worker still needs an isolated OS/container boundary, scoped workspace, egress control, resource limits and Sentinel-issued task credentials. |
| cmux — https://github.com/manaflow-ai/cmux | Public repository. Root licence declares GPL-3.0-or-later for most material and identifies specific directories under BUSL-1.1 requiring a commercial licence for production use/self-hosting. | **Do not adopt as an AEGIS core dependency.** The mixed GPL/BUSL terms conflict with the current simple MIT-compatible reuse preference and may impose production-use restrictions. Study session/workspace UX only; inspect exact directory licence before any component reuse. Also distinguish this repository from other projects named cmux. |
| OpenResearch — https://openresearch.sh/docs | Product documentation identifies a local-first research workspace using existing coding agents and local experiment repositories; managed compute is optional and billed. A canonical public source repository/licence was not established in this pass. | **Workflow reference, not a dependency decision.** Its local experiment trees, logs, metrics and reproducible research artifacts are relevant to Forge. Keep managed compute optional; do not assume it is free or open source. Hold source reuse pending canonical repository and licence. |
| OpenClaw — https://github.com/openclaw/openclaw | Public, active repository; root LICENSE is MIT. | **Continue targeted architecture/security review only.** Study gateway/channel adapters, device pairing and session-scoped identity. Do not embed its gateway as a second AEGIS core. Preserve AEGIS-owned grants, Vault, Sentinel, memory, task state and audit. Treat its extensive integration surface and ambient host access as high-risk until each tool is narrowed and independently contained. |
| oh-my-open-agent — https://github.com/netager/oh-my-openagent | Public repository identity resolves, but root LICENSE path was not resolved; README indicates an ongoing multi-harness refactor and a naming/package transition. | **Hold for deeper inspection.** Potential agent harness/configuration patterns, but first resolve canonical maintainer/repository relationship, exact release/package identity, licence, telemetry defaults, install hooks and supported harness state. No install scripts or package execution. |
| OpenSEO | Exact repository identity not established. | **Hold.** SEO capability is an optional specialist skill only if the user supplies the canonical URL or Forge discovers an unambiguous official project. |
| Atlas | Name is ambiguous; multiple unrelated projects use it. | **Hold.** Do not guess a repository or conflate with unrelated app directories/tools. |

### Architecture decisions from this intake

1. **Local inference:** benchmark Magnitude and Edge0 behind the existing AEGIS provider registry. Do not select either based on marketing throughput; use the same fixed model/task set and compare quality, latency, peak RAM/VRAM, energy/thermal behaviour, install size, platform coverage, offline operation and licence. Include the existing llama.cpp/Ollama-compatible path as a baseline. A local inference engine is an optional backend, never a new AEGIS authority.
2. **Agent runtime:** inspect Pi/pi-mono as the primary minimal-runtime reference and Aider as a coding workflow reference. Compare with current AEGIS plan-only agent-run contract before any integration. Keep task/run IDs, event history, cancellation, approvals and execution receipts canonical in AEGIS.
3. **Session governance:** use ASC as a design comparator for immutable session contracts, ownership boundaries and escalation. AEGIS Sentinel remains the only grant/approval authority. ASC's own documentation explicitly disclaims same-user shell sandboxing; any worker needs an independent OS/container isolation layer.
4. **Research and learning:** evaluate OpenMAIC's classroom workflow and OpenResearch's experiment-artifact workflow as optional Forge/learning modules. No paid compute or hosted provider may be required for core AEGIS operation.
5. **Simulation and world view:** keep MiroFish quarantined pending AGPL review; use God's Eye View only as a public-data visualisation reference with strict source attribution and non-operational warnings.
6. **Terminal/workspaces:** tmux may be used inside a future isolated worker. cmux is not approved for source reuse because of its mixed GPL/BUSL licence terms and platform assumptions.
7. **Unknown identities:** OpenSEO and Atlas remain unresolved. Do not substitute similarly named projects. oh-my-open-agent remains on hold until its current refactor, package names, telemetry and licence are resolved.

### Next source-inspection order

1. Pi/pi-mono and ASC — inspect entrypoints, tool execution path, session state, approval boundary, persistence, tests and dependency tree; compare each contract to AEGIS rather than importing.
2. Magnitude and Edge0 — inspect actual runtime APIs, supported model/platform matrix, installation/update mechanism, telemetry/network behaviour and all model/asset licences; design a reproducible benchmark before any local installation.
3. Aider and OpenClaw — inspect command execution, filesystem boundaries, hooks/extensions, environment inheritance, network and credential handling.
4. OpenMAIC and OpenResearch — inspect data persistence, model/provider requirements, upload handling, session isolation and costs.
5. God's Eye View and MiroFish — inspect data-source provenance, privacy boundaries, simulation assumptions and licence obligations.

**Evidence boundary:** GitHub metadata and selected README/root licence files were checked for the named repositories. This is not a full security audit, dependency audit, reproducible benchmark or production test. No percentage or implementation-completion credit is claimed for this research entry.


---

## REA batch — Hindsight, Nango and OpenViking (16 November 2026)

### Source-level REA: Hindsight

**Canonical source:** https://github.com/vectorize-io/hindsight  
**Pinned inspected revision:** `b92ceb180e349a456d2b5454575067b6ff0f6306` (16 November 2026)  
**Root licence:** MIT; the inspected package manifests also declare MIT.  
**Inspection depth:** focused source-level review, not a complete security/dependency audit. Inspected root README, root licence and security policy, workspace/package manifests, public memory-engine interface, request context and data models, retrieval/fusion modules, retain fact storage and byte-budget code, retraction logic, and representative recall budget/temporal tests.

#### Architecture and mechanisms observed

- Hindsight exposes three core operations: **retain**, **recall** and **reflect**. Its public interface separates these operations from HTTP/MCP transports and storage implementations.
- Memory records are represented as individual units with a bank scope, source document, context, embedding, fact type, event/occurrence/mention timestamps, entity relationships and links. The inspected model distinguishes facts about the world, agent experience and observations.
- Recall is a multi-arm pipeline: semantic retrieval, BM25 keyword retrieval, graph retrieval and temporal retrieval. The arms can be disabled independently. A caller-supplied temporal window is used verbatim and avoids a second model/date-analysis step.
- `search/fusion.py` contains per-source result caps, Reciprocal Rank Fusion (RRF), and interleaving fusion. Interleaving protects each retrieval arm's top results from being crowded out by a large result set from another arm.
- `retain/memory_budget.py` uses estimated in-flight bytes rather than only item counts to apply backpressure. It includes explicit handling for oversized single items and producer/consumer wait coordination.
- `reflect/retractions.py` detects when a stored synthesis cites memory IDs that no longer exist. It distinguishes partial loss of grounding from a wholly unresolvable set of IDs and avoids automatically deleting a synthesis when every citation may simply have been remapped.
- The public request context carries tenant identity and cooperative cancellation; the interface exposes token budgets, temporal filters, fact-type filters and optional trace details.
- The project has extensive specialised code and tests. This is evidence of engineering maturity, not evidence that its full footprint is appropriate for AEGIS.

#### Resource and deployment fit

The root project is a large Python monorepo. The inspected `hindsight-api-slim` package still depends on PostgreSQL/asyncpg, pgvector, SQLAlchemy/Alembic, FastAPI, multiple provider SDKs, telemetry, document parsing and object-storage libraries. Optional local-ML extras include PyTorch, Transformers and Sentence Transformers; the embedded profile uses pg0. The `hindsight-embed` README says first use starts a local daemon and downloads dependencies/loads ML models, which can take 1–3 minutes.

This is a poor direct fit for AEGIS's Cloudflare Pages/Workers + D1 architecture and ordinary Chromebook/iPhone/iPad targets. It would add a separate Python service, a substantial database/vector stack, a large dependency surface and model inference requirements. Local inference options exist, but do not make the entire stack lightweight or guarantee zero hardware cost. Hosted Hindsight Cloud is not an acceptable mandatory dependency.

#### Comparison with existing AEGIS memory

AEGIS already has an AEGIS-native memory substrate with exact owner/personal-or-project scoping, provenance, confidence, sensitivity, expiry, accepted/candidate/superseded/retracted states, append-only lifecycle events and BM25-style lexical ranking. Hindsight therefore does not justify replacing AEGIS memory or introducing a second memory database.

Potential native adaptations, subject to a separate design and tests:
1. Add explicit event-time fields where needed, distinguishing when something happened from when AEGIS learned or recorded it.
2. Consider bounded multi-arm recall: retain AEGIS lexical search, add semantic or temporal arms only when available, then use a small RRF/interleave fusion step. No mandatory embedding model.
3. Preserve per-arm result caps and a strict shared context/token budget so one retrieval method cannot dominate the prompt.
4. Add evidence-linked invalidation checks so accepted summaries or derived memories can be re-reviewed when their supporting memories are retracted or superseded.
5. Borrow byte-budget/backpressure principles for any future ingestion pipeline; do not import Hindsight's Python worker implementation.

#### REA score (provisional, evidence-rated)

| Dimension | Score / 5 | Weighted points | Rationale |
|---|---:|---:|---|
| Demonstrable capability value | 5 | 20/20 | Strong memory, temporal, graph and retrieval techniques |
| AEGIS architecture fit | 3 | 9/15 | Concepts fit; service/runtime architecture does not |
| Security, privacy and controllability | 3 | 9/15 | Tenant context, cancellation and scoped banks observed; no full security audit |
| Runtime footprint and hardware fit | 1 | 3/15 | Python service, PostgreSQL/pgvector and substantial optional local ML |
| Complexity/dependency reduction | 1 | 2/10 | Wholesale adoption would add substantial infrastructure |
| Maintenance, tests and upstream health | 5 | 10/10 | Active upstream and extensive test tree observed |
| Cost/free viability | 3 | 6/10 | MIT and local options, but full local operation has meaningful compute/storage costs |
| Portability and replaceability | 2 | 2/5 | Python/Postgres-oriented implementation; concepts are portable |
| **Total** |  | **61/100** | **Below the adoption threshold** |

**Disposition: reference only + selective AEGIS-native rebuild. Do not install, fork or make Hindsight a runtime dependency.** The MIT licence permits reuse subject to preserving notices, but the recommendation is to implement the selected concepts independently within AEGIS contracts. Confidence: medium for architecture/footprint assessment; low-to-medium for security because this was not a complete audit. No upstream code was executed or copied.

### Nango — preliminary triage only

**Canonical source:** https://github.com/NangoHQ/nango  
**Inspected revision family:** default branch `master`; current commit was not pinned for a full REA.  
**Root licence:** Elastic License 2.0 (ELv2), confirmed from the actual `LICENSE` file. It restricts offering the software as a hosted/managed service to third parties and contains additional licence-key and notice conditions. The README describes a limited free self-hosted tier and paid Cloud/BYOC feature sets.

**Verdict:** not suitable as an AEGIS core dependency. Its OAuth lifecycle, token refresh, connection records, provider proxy and integration-function patterns are worth studying against AEGIS's existing Composio/Sentinel/Vault boundaries. AEGIS must retain its own credential custody, grants, approval, audit and provider-neutral contracts. Do not adopt the platform or copy code under ELv2 without a specific legal/use-case review. This is not yet a full source-level REA.

### OpenViking — preliminary triage only

**Canonical source:** https://github.com/volcengine/OpenViking  
**Pinned revision:** not yet recorded for a full REA.  
**Root licence:** AGPL-3.0 for the main project; the README identifies separate Apache-2.0 licensing for `crates/ov_cli` and examples, with third-party components retaining their own licences.

**Mechanisms worth investigating:** filesystem-like context URIs, hierarchical resources/memories/skills, directory-scoped retrieval, L0 abstract → L1 overview → L2 detail loading, inspectable context trees, and session-to-memory processing. These patterns could help AEGIS reduce unnecessary context loading and make memory inspectable.

**Verdict:** architecture reference only pending a full source, dependency and licence review. Do not adopt the AGPL core into the MIT AEGIS codebase without a documented compatibility/distribution review. Its Python/Rust and vector/context-database stack must also be compared against the existing AEGIS-native D1 memory model before any implementation decision. This is not yet a full source-level REA.

**Batch boundary:** Hindsight received a focused source-level REA; Nango and OpenViking received preliminary triage only. No repositories were installed, executed, forked or integrated. No AEGIS feature-completion credit is claimed for this research.


---

## AEGIS Security Suite — architecture decision (16 November 2026)

**Decision:** establish a first-class, modular Security Suite. The architecture and threat model are in [AEGIS_SECURITY_SUITE.md](AEGIS_SECURITY_SUITE.md), with the canonical pillar recorded in [AEGIS_MASTER_BLUEPRINT.md](AEGIS_MASTER_BLUEPRINT.md).

The suite separates privacy/exit VPN from private device-mesh networking; uses established protocols and OS VPN APIs rather than custom cryptography; and treats VPN as one network-privacy control, not malware protection or anonymity. Device posture, account/session security, threat detection, secure development, recovery and Security Centre visibility are equally important.

**Initial REA queue (not yet source-audited for this decision):**
- Network: WireGuard; compare self-hosted mesh/control-plane candidates such as Headscale and NetBird with commercial/managed options only as optional adapters. Evaluate exit-node support separately from private mesh connectivity.
- Endpoint: osquery and Lynis as focused candidates; Wazuh only if its resource and maintenance footprint is justified.
- Application/security testing: CodeQL, OWASP ZAP, curated Nuclei, secret scanning and Sigma rules, each behind explicit scope and safety controls.
- VPN platform fit: verify current iOS/iPadOS, ChromeOS, Android and desktop OS APIs, kill-switch/always-on support, DNS behaviour, key storage and recovery before implementation.

**Boundary:** this is an architecture decision and research queue, not a completed REA or implementation. No tool was installed or executed; no VPN provider or paid service was activated; no production configuration changed. Every candidate must be pinned and assessed under the mandatory REA standard before adoption. Feature-completion percentage is unchanged.
