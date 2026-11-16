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
