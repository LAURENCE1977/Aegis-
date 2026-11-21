# AEGIS INFINITY — Mass Experimental Audit

**Audit started:** 2026-11-21  
**Scope:** AEGIS implementation history and every externally supplied software/repository candidate captured in the project research notes.  
**Status:** Initial inventory and architecture audit. This is not a claim that every candidate has been run in a sandbox.

## Executive summary

AEGIS already has a meaningful read-only software inspection foundation, immutable evidence contracts, advisory normalisation/matching, signed inventory verification, persistent nonce protection, workflow definitions/runs/checkpoints, and several Agent Operations Inbox drafts.

However, the repository does **not yet contain an enforced disposable execution sandbox**. The Experimental Laboratory profile is a policy description only. It does not create or enforce a container, microVM, namespace, cgroup, filesystem mount, seccomp profile or egress firewall.

The safe mass-audit path is therefore staged:

1. Inventory and pin exact repository commits.
2. Inspect allowlisted source files using Forge's existing read-only path.
3. Analyse licences, maintenance, dependency manifests, security advisories and capability signals.
4. Produce evidence-backed compatibility and threat assessments.
5. Only after a separately reviewed isolation runner exists, execute selected candidates in disposable, resource-bounded experiments.
6. Produce proposed adapters/patches in draft branches; require human review and independent Sentinel authorization before integration.

**No third-party project listed below is represented as installed, executed, integrated or sandbox-tested merely because it was researched.**

## 1. What AEGIS already has

### 1.1 Existing read-only Forge and software intelligence

The inspected implementation at the audit branch includes:

- Owner-authenticated, same-origin Forge repository inspection and pinned blob reads.
- Fixed GitHub API origin, HTTPS-only public GitHub source handling, redirects rejected, request/response bounds and timeout.
- Repository inspection limits documented as up to 100 selected text files, 32 KiB each.
- Capability analysis reuses Forge rather than adding a second fetcher; analysis is bounded to 20 files, 32 KiB per file and 256 KiB aggregate.
- Immutable repository/tree/blob identity checks and explicit incomplete-coverage reporting.
- Deterministic lexical capability indicators for orchestration, MCP, memory, observability, provider routing, security isolation and testing.
- Metadata assessment pinned to owner/name + full commit SHA, with archived/missing-licence/staleness review signals.
- Advisory evidence normalisation and conservative exact package/version inventory matching.
- HMAC-based inventory source attestation verification plus persistent owner/source/nonce replay protection.
- Experiment evidence records, owner-scoped storage, verification, history analysis and human proposal review contracts.

**Limit:** lexical source indicators are candidate signals, not proof of security, quality or correct functionality. Existing Forge inspection does not build, install, run or test upstream code.

### 1.2 Agent workflows and operations work

The current open draft stack contains:

- #151 workflow definition contract: bounded ordered steps, allowlisted capabilities, evidence requirements and human-gated write/test steps.
- #152 immutable plan-only run envelope pinned to workflow definition digest.
- #153 durable owner-scoped append-only workflow checkpoints.
- #154 operation request contract.
- #155 owner-scoped persistent Agent Operations Inbox.
- #156 digest-bound human review ledger.
- #157 authenticated runtime/Pages Inbox routes.
- #158 a parallel Sentinel-bound Inbox item contract.
- #159 deny-by-default Experimental Laboratory profile contract.

**Branch topology warning:** #154–#157 form one sibling chain based on #153. #158 is a separate Inbox-item-contract branch also based on #153. #159 is stacked on #158. These branches are not yet reconciled into one integrated Inbox implementation. Do not assume the route/store/ledger path and the #158 item-contract path are already wired together.

### 1.3 Experimental Laboratory status

PR #159 adds a pure, immutable profile contract with:
- five workload labels;
- bounded CPU, memory, wall-time and output limits;
- network disabled;
- ephemeral filesystem intent, read-only source mount and quarantined output intent;
- no credentials, secret mounts, host access, container socket, privileged mode or inter-experiment communication;
- human review and Sentinel required; execution not authorised.

The contract is useful policy scaffolding, but these fields do not enforce operating-system isolation. A real runner is still required. The Cloudflare Pages preview build succeeded. Node tests passed in the current workflow; the wider D1/Worker verification was still running at the last recorded check. Full CI is therefore **not yet certified green** in this audit.

## 2. AEGIS pull-request / integration status

At audit start, GitHub returned 28 open draft PRs numbered #132–#159. None were merged. The important distinction is:

- **Implemented on a draft branch** means code exists and may have branch-local tests.
- **CI verified** means the relevant workflow completed successfully for that exact head SHA.
- **Integrated** means the code is in the intended parent/main branch after review and merge.
- **Production active** means separately deployed and configured.

Do not collapse these statuses.

| PR range | Workstream | Audit interpretation |
|---|---|---|
| #132–#133 | Code Mode research and fail-closed hand-off | Research/contract; not an execution sandbox |
| #134–#143 | Experiment evidence, persistence, analysis, proposals, review, evidence verification | Strong evidence/governance foundations on draft branches |
| #144–#150 | Software intelligence, pinned source inspection, advisory evidence, inventory matching, source attestation and nonce replay protection | Read-only software intake and provenance controls; not upstream code execution |
| #151–#153 | Agent workflow definition, plan-only run and durable checkpoints | Workflow planning/history, not an executing agent runtime |
| #154–#157 | Operation request, inbox store, review ledger and routes | Draft sibling implementation path; reconcile with #158 |
| #158 | Sentinel-bound operation Inbox item contract | Parallel request-contract path |
| #159 | Experimental Lab profile contract | Policy only; no actual sandbox runtime |
| #116–#123 | Provider registry, pricing provenance, adapter allowlist and routing | Provider control-plane work on draft branches |
| #122–#130 | Integration control plane, connection inventory/audit, preflight and Sentinel gating | Integration governance work on draft branches |
| #106–#110 | Build progress, companion lifecycle and opt-in model adapter | Companion/observability work on draft branches |
| #111–#114 | Research companion, AG-UI context and parallel build-lane documentation | Supporting work on draft branches |

Older open PRs also include native automation, memory substrate, MCP, research intake and optional tool evaluations. These require a separate dependency/branch-stack reconciliation before integration.

## 3. External candidate inventory — prior research triage

The entries below consolidate repositories and projects submitted by the user or discovered during previous research. A prior desk review is **not** a sandbox execution result. Exact commit, licence, dependency tree and security status must be re-pinned at the time of a future experiment.

### 3.1 Agentic operating systems, orchestration and operations

| Candidate | Previously identified purpose / potential AEGIS use | Initial disposition |
|---|---|---|
| ANOLISA — https://github.com/agentic-os-org/ANOLISA | Agent runtime, security core, memory, observability and checkpointing patterns | High-priority source inspection; scrutinise OS-level claims |
| Ouroboros — https://github.com/Q00/ouroboros | Requirements/specs/tasks, multi-agent execution and evaluation | Study evidence/review workflow; no autonomous promotion |
| Octopus Superintelligence OS | Rust research OS/runtime concepts, capability contracts and verifiers | Exact repo identity/commit to reconfirm; research only |
| Vstorm AgenticOS — https://github.com/vstorm-co/agenticos | Governed agents, workspaces, RBAC, budgets, approvals, audit | Architecture reference; infrastructure footprint may not fit AEGIS |
| holaOS — https://github.com/holaboss-ai/holaOS | Electron workspace, agents, memory, MCP and models | UI/workspace reference; desktop fit and permissions review |
| itseffi/agentic-os | Cross-agent skills/workflows | Pin exact commit and licence before assessment |
| iops/agentic-os | Agentic OS candidate | Identity and implementation require fresh verification |
| panakh/agentic-os | Agentic OS candidate | Identity and implementation require fresh verification |
| modimihir07/agentic-os | Agentic OS candidate | Identity and implementation require fresh verification |
| desplega-ai/agent-swarm | Agent swarm patterns | Review spawn authority, isolation and provenance |
| GCWing/OpenBitFun | Agentic software workspace candidate | Fresh source and licence inspection required |
| affaan-m/everything-claude-code | Agent skills/workflow blueprint | Reuse patterns only after licence and security review |
| Tencent/LoopForge — https://github.com/Tencent/LoopForge | Self-hosted agentic software delivery, Docker sandboxes, SOPs, checkpoints and human gates | High-priority architecture inspection; Docker socket and approval enforcement are critical risks |
| herdrdev/herdr — https://github.com/herdrdev/herdr | Persistent coding-agent sessions, workspaces, coordination | High-priority operations/session reference; audit socket API and terminal authority |
| Gaurav-Gosain/tuios — https://github.com/Gaurav-Gosain/tuios | TUI agent manager, isolated worktrees, inbox and scoped grants | High-priority Inbox/worktree reference; UI approvals are not enforcement |
| CopilotKit/OpenBot — https://github.com/CopilotKit/OpenBot | Agent-specific computers, browser/files/tools, AG-UI and action records | High-priority isolation architecture review; verify server-side policy and credential separation |
| meetopenbot/openbot — https://github.com/meetopenbot/openbot | Local agent server and SSE control API | Separate project; licence version boundary and API security need review |
| ashhart/OpenBOT — https://github.com/ashhart/OpenBOT | Desktop interface for coding-agent CLIs | Early-stage UI reference |
| openbot-coder/openbot-ai — https://github.com/openbot-coder/openbot-ai | Personal agent, WebUI, tools, memory, MCP and automation | Fork/rebrand; inspect attribution, provenance and tool permissions |
| Orkas — https://github.com/Orkas-AI/Orkas | Desktop AI team, specialist agents, project/task orchestration | Workflow reference; do not copy auto-advance as approval |
| Hermes Workspace — https://github.com/outsourc-e/hermes-workspace | Browser workspace, terminal, memory, MCP, worker sessions and operations | High-priority source audit; approval-store implementation discrepancy previously observed; terminal is powerful |
| Hermes Conductor — https://github.com/forcewake/hermes-conductor | Multi-harness coding orchestration, worktrees, reviewer/remediation loops | Study evidence-based completion and worker isolation |
| Ankh.md — https://github.com/Abruptive/Ankh.md | Agent/swarm collaboration | Experimental; implementation and security unverified |
| Hermes Miniverse — https://github.com/teknium1/hermes-miniverse | Agent status and communication simulation | Simulation reference only; inbound messages untrusted |
| HermesCraft — https://github.com/agorokh/hermescraft-bot | Agent simulation in Minecraft | Optional research/simulation, not core runtime |

### 3.2 Memory, context, observability and token efficiency

| Candidate | Previously identified purpose / potential AEGIS use | Initial disposition |
|---|---|---|
| AutoContext — https://github.com/greyhaven-ai/autocontext | Evaluation-driven improvement loops, lessons and controlled promotion | High-priority improvement-loop reference; no self-promotion |
| Hermes LCM — https://github.com/stephenschoettler/hermes-lcm | Lossless context history and summary DAG | High-priority memory/retrieval reference |
| Honcho self-hosted — https://github.com/elkimek/honcho-self-hosted | Self-hosted agent memory layer | Review data isolation, retention and inference routing |
| PLUR — https://github.com/plur-ai/plur | Shared local-first memory across agents | High-priority portability reference; assess sync/forget semantics |
| ClawMem — https://github.com/yoloshii/ClawMem | Local SQLite memory, hybrid retrieval and prompt-injection filtering | High-priority memory candidate; test poisoning and cross-agent boundaries |
| Casual Memory — https://github.com/casualgenius/casual-memory | Semantic memory, duplicate/contradiction detection, confidence and expiry | Evaluate against AEGIS memory contracts |
| LLM Trim — https://github.com/fkiene/llmtrim | Prompt/context trimming and token reduction | Benchmark quality and privacy; savings are unverified until measured |
| AgentTrace — https://github.com/luoyuctl/agenttrace | Local agent session/token/cost/latency analytics | Observability reference |
| AgentBurn — https://github.com/Socialpranker/agentburn | Local spend and loop profiler | Observability reference; inspect local session/credential access |
| MemPalace — https://github.com/MemPalace/mempalace | Conversation preservation and retrieval | Compare with existing memory substrate |
| Tokscale — https://github.com/junhoyeo/tokscale | Coding-agent token/cost tracker | Cost dashboard reference; keep metrics private and disable public submission |
| Hermes LCM, PLUR, ClawMem, Casual Memory, Honcho and MemPalace | Overlapping memory approaches | Run a common recall/forget/poisoning/latency benchmark before choosing; do not install all |
| LintLang — https://github.com/hermes-labs-ai/lintlang | Static linting of agent instructions/tool schemas | Good CI quality-gate candidate; not runtime security |
| Detect Skill — https://github.com/resemble-ai/detect-skill | Media authenticity and synthetic-content detection | Optional external service; privacy/consent review required |

### 3.3 Security, OSINT and threat-intelligence candidates

| Candidate | Previously identified purpose / potential AEGIS use | Initial disposition |
|---|---|---|
| WebHackersWeapons — https://github.com/hahwul/WebHackersWeapons | Catalogue of security testing tools | Source catalogue only; assess each tool independently |
| OSINT Stuff — https://github.com/cipher387/osint_stuff_tool_collection | Large OSINT resource catalogue | Curate defensive infrastructure sources; privacy/legal review |
| Ph055a/OSINT_Collection — https://github.com/Ph055a/OSINT_Collection | OSINT resource directory | Archived and licence unclear in prior review; no reuse pending verification |
| PentAGI — https://github.com/vxcontrol/pentagi | Autonomous penetration testing | High-risk; defensive architecture review only; Docker isolation and tool authority critical |
| MVT — https://github.com/mvt-project/mvt | Mobile threat/spyware forensic analysis | High-priority defensive reference for mobile threat evidence |
| Snake / Turla-Uroburos | Espionage malware family | Threat-intelligence/detection research only; no malware execution |
| Industroyer2 | ICS/OT destructive malware | Defensive OT threat modelling and detection only |
| SORM | Lawful-interception/surveillance infrastructure | Privacy and threat-intelligence context only |
| Leer-3 | Electronic warfare / cellular disruption system | Defensive resilience/threat model only |
| Pegasus spyware | Mobile spyware threat | Defensive indicators, forensic workflows and response only |
| ARTEX | Previously identified as a potentially dangerous AI-assisted offensive framework; exact identity and claims require revalidation | Threat-intelligence only; do not reproduce attack automation |
| Darkmoon (listed by WebHackersWeapons) | Autonomous testing with real exploit execution, as previously described | High-risk; do not execute in initial candidate batch |
| OWASP ZAP, Jaeles, Burp Suite, Metasploit, Axiom, Hetty, Caido | Tools listed in the WebHackersWeapons catalogue | Each is a separate candidate requiring version, licence, scope and safe-fixture review |
| TruffleHog | Secret discovery (referenced in existing AEGIS research register) | Evaluate in private test fixtures; never print or verify detected secrets automatically |

### 3.4 Document intelligence, RAG, search and research

| Candidate | Previously identified purpose / potential AEGIS use | Initial disposition |
|---|---|---|
| RAG-Anything — https://github.com/HKUDS/RAG-Anything | Multimodal document ingestion/retrieval | High-priority document-intelligence benchmark; parser isolation required |
| FutureSmart Document Intelligence — https://github.com/FutureSmart-AI/document-intelligence | Document extraction, collections and grounded answers | High-priority candidate; evaluate extraction accuracy and provenance |
| Vane — https://github.com/ItzCrazyKns/Vane | Self-hosted search with citations and document uploads | Search UX/reference; independently verify citations |
| Open WebUI — https://github.com/open-webui/open-webui | Self-hosted AI interface, RAG, tools, MCP, voice | Architecture reference; non-standard licence and powerful Python tool execution risk |
| CodeGraph — https://github.com/codegraph-ai/CodeGraph | Semantic code graph and MCP tools | High-priority read-only code-intelligence pilot; audit tool scope |
| codegraph — https://github.com/colbymchenry/codegraph | Separate similarly named code graph project | Compare exact project before selection; don't confuse with CodeGraph AI |
| Market Research Agent — https://github.com/sohenpatel22/market_research_AI_agent | SEC/market data research workflow and citations | Research quality pattern; not financial authority |
| Generic RAG chatbot examples | Basic retrieval/chat patterns | Lower priority than mature document systems |
| XERJ | Previously identified as AI search/MCP concept | Exact repository identity/commit needs confirmation |

### 3.5 Browser, API, application and creative pipeline candidates

| Candidate | Previously identified purpose / potential AEGIS use | Initial disposition |
|---|---|---|
| Jev Ultrafast — https://github.com/browser-use/jev-ultrafast | Browser agent with numbered elements and constrained action validation | High-priority browser safety reference; verify exact repo/commit |
| Reverse API Engineer — https://github.com/nottelabs/reverse-api-engineer | HAR/network capture to typed API clients | High-priority API discovery reference; HAR cookies/tokens and generated code are sensitive |
| Google ARTEMIS — https://github.com/google/artemis | Android automation and device testing | Optional mobile QA; user-device and permissions review |
| Open Terminal | API-controlled terminal | High-risk; do not connect to production or unrestricted host |
| OpenDesign — https://github.com/nexu-io/open-design | Local-first design/prototype workspace | Design/Forge reference; inspect daemon permissions and telemetry |
| Genblaze — https://github.com/backblaze-labs/genblaze | Multimodal generation pipeline with replay/provenance | Creative pipeline candidate; provider costs and media provenance review |
| AutoClip — https://github.com/artbyjazi/autoclip | Local video clipping/transcription | Optional media workflow; inspect model and media handling |
| Remotion — https://github.com/remotion-dev/remotion | Programmatic React video creation | Creative pipeline candidate; confirm current licence tiers |
| SolidCraft | Parametric CAD | Future 3D/media workflow; exact source identity and file execution risks to verify |
| NVIDIA SANA — https://github.com/NVlabs/Sana | Image generation/model research (previously matched to SANA family) | Model/visual simulation research; compute/licence/model-weight review |
| Google AI Pro | Subscription product, not a source repository or API entitlement | Do not treat subscription as free API access |
| Reflection Beam — https://huggingface.co/reflection/Beam-1.0-501B-A23B | Large model candidate | Hosted benchmark only unless verified hardware supports it |
| Gemini 4 | Model family claim from previous research | Release/model identifiers and API availability unverified; do not integrate on name alone |
| DeepSeek 4.1 | Model/version claim from previous research | Exact model ID, capabilities and endpoint unverified |
| Locally Uncensored — https://github.com/PurpleDoubleD/locally-uncensored | Local model/desktop studio | Provider/UI reference; verify licence and local secret handling |
| MuMuAINovel — https://github.com/xiamuceer-j/MuMuAINovel | Multi-provider AI novel-writing application | Optional creative workflow; GPL-3.0 was reported previously, verify exact source |
| Job Scout — https://github.com/jamwithai/observable-job-agent | Observable job-matching agent | Not core AEGIS; possible example of human-reviewed agent outputs |

### 3.6 Ambiguous or unresolved names

The following labels were supplied without enough reliable identity information to safely pin a repository or model. They must remain **unverified**, not guessed:

- Scan-V
- Amesit
- Krystal-2B
- Anatomy
- Personalive
- Redlink
- Kiri
- Octopus Superintelligence OS exact repository identity
- Open Terminal exact repository identity
- “Google Artemis” versus other similarly named projects
- “Google Pro” as a product/model/API reference
- “Artex” exact project identity
- “Snake” if a repository other than the Turla malware family was intended
- “SORM” and “Leer-3” if specific repositories or reports were intended

The user may supply links later; the audit should not invent identities.

## 4. Mass audit priority and batch plan

### Batch A — AEGIS's own foundation and immediate risk
1. Reconcile PR #154–#158 Inbox branches and their data contracts.
2. Complete exact-head CI verification for #159 and the parent branches.
3. Review Forge read/read-analysis code for path traversal, content handling, source pinning, rate limits and denial-of-service bounds.
4. Review current branch protection, draft stack dependencies and merge readiness.
5. Add a testable experiment registry and assessment lifecycle before any external execution.

### Batch B — Operations and isolation references
- Tencent LoopForge
- Herdr
- TUIOS
- CopilotKit/OpenBot
- Hermes Workspace
- ANOLISA
- PentAGI (defensive review only)

Focus: actual process isolation, host/container socket access, filesystem mounts, network policy, credentials, approval enforcement, audit completeness, cancellation and teardown.

### Batch C — Memory and improvement
- Hermes LCM
- PLUR
- ClawMem
- Casual Memory
- Honcho
- MemPalace
- AutoContext
- AgentTrace / AgentBurn / Tokscale
- LintLang

Use a common synthetic benchmark for recall fidelity, deletion/forget semantics, poisoning resistance, cross-user isolation, latency and token/cost overhead.

### Batch D — Code intelligence and developer workflow
- CodeGraph
- OpenDesign
- Reverse API Engineer
- Jev Ultrafast
- Open Terminal
- OpenSRE
- Hermes Conductor

Focus: read-only source analysis first; then isolated fixtures for code generation, browser actions and build/test workflows.

### Batch E — Documents, search and multimodal
- RAG-Anything
- FutureSmart Document Intelligence
- Vane
- Open WebUI
- Genblaze
- AutoClip
- Remotion
- SANA

Focus: parser sandboxing, prompt injection from files, provenance, citation verification, model/data licences, resource ceilings and provider cost.

### Batch F — Defensive security intelligence
- OSINT Stuff
- WebHackersWeapons
- MVT
- TruffleHog
- PentAGI
- ZAP / Jaeles / Burp / Metasploit / Axiom / Hetty / Caido
- Pegasus, Snake, Industroyer2, SORM and Leer-3 threat references

Start with read-only source/advisory analysis and synthetic fixtures. Do not run malware, exploit real targets, perform uncontrolled scanning, or connect tools to production systems.

## 5. Required controls before real sandbox execution

A profile object is not an isolation boundary. The future runner must independently enforce and test:

- Disposable VM/microVM or comparably strong isolation for untrusted execution; container-only isolation must not be assumed sufficient.
- Non-root, unprivileged identity; no host PID/network/IPC namespace sharing.
- No Docker/container runtime socket, host home directory, SSH agent, browser profile or production credentials.
- Read-only pinned source input; separate bounded output volume; output quarantine and malware/content scanning before inspection.
- Network disabled by default; if a specific test requires network, use a separately approved, narrowly scoped egress proxy and DNS/IP policy. No metadata-service access.
- CPU, memory, process count, file count, disk, output, wall-clock and log limits.
- Syscall restrictions (seccomp or equivalent), capability dropping, read-only base filesystem and temporary writable workspace.
- Per-experiment identity and isolation; no inter-experiment communication or shared writable caches.
- Cancellation, watchdog, teardown verification and cleanup on crash/timeout.
- Reproducible image digest, runner version, source commit/blob digests, configuration digest and full event log.
- Adversarial tests for escape attempts, path traversal, symlink attacks, archive bombs, fork bombs, disk exhaustion, DNS rebinding, SSRF, credential discovery and malicious output files.
- Sentinel authorisation for any access beyond the default-deny profile. A review UI or model decision is never the security boundary.

## 6. Required experiment record

Every candidate experiment should record:

- candidate ID, canonical repository, pinned commit and licence evidence;
- source provenance, collection time and inspected paths/blob SHAs;
- sandbox image/runtime version and profile digest;
- exact command/test plan, network policy and resource limits;
- dependency inventory and advisory matches;
- observed outputs, logs and test results (with secrets redacted);
- coverage gaps, failures, security observations and cleanup verification;
- compatibility assessment against the current AEGIS architecture;
- estimated integration cost, operational cost and maintenance burden;
- recommendation: reject / hold / adapt / candidate-for-review;
- human review event and separate Sentinel authorisation state.

A successful experiment is not approval to merge. The approval must bind to the exact proposed patch, source commit, test evidence and action digest.

## 7. What is safe to do now versus what must wait

**Can proceed now without a runtime sandbox:**
- Re-pin public repositories and inspect allowlisted source at immutable commits through Forge.
- Review README, licence text, dependency manifests and security advisories as untrusted data.
- Perform deterministic static analysis and compatibility mapping.
- Run AEGIS's own tests and local D1/Worker dry-run checks.
- Prepare non-executing adapter proposals and draft PRs.

**Must wait for the real runner:**
- Installing third-party packages.
- Running upstream tests/build scripts or generated clients.
- Running agent frameworks, browser automation or MCP servers from candidate repositories.
- Executing scanners, fuzzers, exploit tools or malware samples.
- Connecting candidates to credentials, production data, live user accounts or production networks.

## 8. Initial audit verdict

AEGIS has the beginnings of a disciplined software-intelligence and evidence-governance system. It does not yet have a real sandbox capable of safely executing arbitrary external products. The best near-term acceleration is to use Forge for bulk pinned source inspection and static assessment while building the runner as a separate, tightly controlled subsystem.

**The next implementation gate should be a real isolated runner and a mass-audit registry—not a broad package installation spree.** Keep all PRs draft until branch reconciliation, exact-head CI and security review are complete.
