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
| Kiri — unresolved identity | https://kiri.build/ (possible product); possible GitHub candidates include https://github.com/Yeshwanthyk/kiri and https://github.com/david-d25/kiri | Namesake projects differ materially: local AI workspace with saved knowledge/workflows; keyboard-first local agent control plane; Telegram autonomous agent. | Do not choose or fork until the intended Kiri repository is confirmed. The local-workspace/control-plane variants are relevant to AEGIS desktop/workspace architecture. |
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
