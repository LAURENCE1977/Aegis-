# AEGIS Infinity — retrospective engineering and repository audit

**Audit date:** 23 November 2026  
**Repository:** https://github.com/LAURENCE1977/Aegis-  
**Working branch:** `feature/aegis-infinity-free-first-orchestration-2026-11-23` (PR #202)  
**Purpose:** consolidate the recoverable AEGIS/ODIN project history, separate real implementation from research and stacked proposals, identify overlap, and establish a rational integration plan.

> This is a historical audit snapshot, not a claim that every candidate has been independently re-reviewed at its latest upstream commit. Names are classified by the evidence currently available in the AEGIS repository, PR history and prior project discussions. Unknown identity, licence, provenance or current maintenance is a hold—not permission to copy or execute.

## 1. Executive conclusion

**Keep AEGIS as the single system of record and preserve ODIN as its intelligence/orchestration layer.** The original division remains sound:

- **AEGIS:** identity, sessions, policy, permissions, integrations, approvals, secrets, audit, durable task state, delivery and operator control.
- **ODIN:** reasoning, task decomposition, model/provider selection, research, memory retrieval, specialist agents and creation workflows.
- **Sentinel:** the enforcement authority between an agent's proposal and any capability invocation.
- **Forge:** discovers and evaluates external capabilities, records evidence and licences, and proposes small AEGIS-native adaptations. Discovery never grants execution rights.
- **Devices:** optional, separately authenticated workers/observation clients; not trusted masters and not a generic remote shell.

The strongest strategy is **not to merge dozens of agent platforms into one codebase**. It is to retain the working AEGIS foundations, extract selected patterns behind narrow interfaces, and keep external systems as optional adapters only when they solve a demonstrated gap.

The user's hard operating constraints remain: free services/free tiers only; no trials, paid APIs, surprise spend or billing activation; mobile/browser-first; minimal manual terminal work; no secrets in chat; explicit approval for production, destructive, costly, security-sensitive or externally consequential actions.

## 2. Evidence and current repository state

### 2.1 Pull-request history

The GitHub pulls API returned **201 pull-request records** across three pages, covering PR numbers 1–202 with PR #102 absent from the returned pages. The returned records classify as:

- 109 open
- 92 closed
- 34 merged
- 58 closed but not merged
- 102 open drafts
- 7 open non-draft PRs

The count is a snapshot of the API response; reconcile the missing #102 record before treating these totals as a perfect complete ledger.

Important consequence: **closed is not the same as merged**. A number of PRs are superseded, repair attempts or abandoned branches. A green check on an old branch is not evidence that the code is in current `main`.

PRs #1–#97 contain the early foundation and several merged milestones. PRs #98–#202 contain later research, repairs, experiments and stacked development. The latest active chain is:

- #200 — scoped social/repository research intake
- #201 — Meta and infrastructure connector isolation
- #202 — free-first orchestration and device bridge

PR #202 is open, draft and unmerged. At the initial audit snapshot it had 107 commits and 40 changed files at head `12bf43671baf99b3d51b658cde61ea3d8803282a`; this audit document then added two documentation commits. The current PR head is `2502763889d2ac1b46b6c05c634d5decd26fda34`, with 109 commits and 41 changed files. It is stacked on #201. Do not describe the whole stack as production-live.

### 2.2 Merged foundation milestones

The returned history identifies these merged milestones:

- #1 secure APIs and native Superpowers skills foundation
- #2 canonical master blueprint and agent handover
- #3 authenticated MCP Bridge endpoint
- #4 first durable job runtime
- #5 runtime recovery tests
- #13 capability registry implementation
- #16 durable exact-operation capability approvals
- #21 owner-only capability approval inbox and decisions
- #42 MergeLoop configuration
- #43 dead-letter recovery
- #46 Project Spaces
- #47 Sentinel invocation gate
- #48 metadata-only MCP Forge catalogue
- #50 verified-only Free-Tier Ledger
- #53 owner-scoped native memory substrate
- #56 governed capability, vault, audit and token foundations
- #58 canonical approval payload digests
- #61 durable plan-only specialist orchestration
- #65 Sentinel D1 composition
- #66 agent-to-Sentinel capability bridge
- #68 safe read-only GitHub repository inspection
- #71 owner-only capability grant management
- #74 isolated capability D1 migration checks
- #75 Project Space handover briefs
- #78 bounded GitHub metadata adapter
- #83 Forge candidate storage and licence gates
- #86 restricted Sentinel read-only invocation route
- #87 Security Centre
- #90 atomic capability rate limits
- #93 guarded AG-UI model tools
- #94 AG-UI streaming/protocol tests
- #95 owner repository review
- #96 Control Centre and installable PWA
- #97 Anthropic Messages streaming provider adapter

These are historical merge records. Current-main source and tests still need to be checked for each capability before relying on it.

### 2.3 Current implementation boundaries

The repository's own Forge documentation says the current live foundation includes authenticated read-only module/capability catalogues, public GitHub repository metadata/tree/blob inspection, candidate validation, and a fail-closed policy evaluator. It also explicitly says candidate/knowledge persistence and general connector invocation are not complete; the registry does not grant permissions; and the evaluator is not yet wired to a grant store or runtime.

The runtime queue remains plan-only. Device pairing and read-only observation source exists on PR #202, but no phone is paired, no native Android companion is installed, no Chromebook client is complete, and no device-side task execution is enabled. The ChatGPT Android app itself does not expose a supported API for this chat to control the phone.

PR #202's description records a successful expanded test run of 608 passed / 0 failed at implementation head `71dedc244d912e4c6903c6d2be07cc6a4c2f3cbb`, with isolated local D1 migration/smoke checks. The latest documentation-only head is later; rerun current checks before merge. No production D1 migration, production deployment, DNS/secret change, phone pairing or permission grant has been performed.

The currently authenticated Cloudflare account inventory previously showed one Worker (`lozwebsite`), zero Pages projects, zero D1 databases and zero Queues. The preview deployment account context did not match that inventory. Therefore production resource bindings remain unverified.

## 3. Project evolution by workstream

### A. Security, identity and execution governance

Work includes secure session APIs, capability manifests, owner-scoped grants, encrypted secret vault foundations, exact-operation approvals, canonical payload digests, Sentinel preflight/invocation, append-only audit, per-capability rate limits, revocation, idempotency and bounded adapters.

**Assessment:** This is the most important AEGIS differentiator. Preserve it as the single authority. Do not import another agent framework's permission system as a competing authority. All external tools and devices must pass through Sentinel.

### B. Durable runtime and specialist agents

Work includes the Worker/D1/Queue runtime, outbox/lease recovery, dead-letter recovery, durable run envelopes, checkpoints, specialist-agent plans, operation inbox and workflow proposals.

**Assessment:** Keep the AEGIS runtime as the first execution engine. Several workflow-engine projects overlap heavily; do not deploy a second orchestrator until a measured requirement exceeds the current runtime's limits.

### C. Memory and Project Spaces

Work includes an owner-scoped memory substrate, Project Spaces, handover briefs, typed events and research into local-first retrieval/knowledge graphs.

**Assessment:** AEGIS owns canonical memory and project/task state. Add retrieval adapters or graph indexes only as subordinate stores with provenance, ownership, correction and deletion semantics. Do not split canonical memory across competing agents.

### D. Model and provider routing

Work includes the native provider/token engine, provider registry and allowlists, unknown-price handling, model provenance/freshness, OpenRouter, AxForge, BitNet, Ollama/Magnitude, Anthropic streaming, LM Studio research, generic OpenAI-compatible streaming, APInex research/adapter, usage telemetry, reservations, settlement and paid-run approval controls.

**Assessment:** Consolidate to one provider-neutral adapter contract and one policy-driven router. Free-first/Infinity Zero must be the default route. Unknown or metered costs must fail closed. Keep provider credentials server-side and resolve them only after authorization. Do not create a provider-specific branch for every model vendor.

### E. Forge and repository intelligence

Work includes public GitHub discovery, immutable tree/blob inspection, candidate records, licence gates, evidence provenance, capability manifests and software/security intelligence research.

**Assessment:** Forge should become the authoritative catalogue for all candidate projects. It must distinguish repository, package, API, hosted service, model, protocol, dataset and knowledge source. Pin exact commits and licence evidence before reuse. Do not run candidate code in the control plane.

### F. User interface, device and computer control

Work includes mobile-first Control Centre/PWA, Project Spaces, Security Centre, AG-UI streaming, voice companion contracts, browser policies, device pairing and the proposed Machine Control adapter.

**Assessment:** One AEGIS interface and one device bridge. Begin with status/read-only observation, then screenshots and tightly scoped interactions after explicit approval. No public ADB, generic shell, unrestricted browser or unattended sensitive actions.

### G. Media, design and creation

Work includes companion renderer, OpenCut research, SolidCraft CAD research, 3D Website Builder, design-system/component research, Google Stitch and AI Studio.

**Assessment:** Keep Media Studio optional and modular. Do not burden the core runtime with creative packages. Use a single accessible design foundation rather than combining multiple competing component systems.

## 4. Repository and project inventory

This is the recoverable candidate inventory from the source register, PR patches, owner-repository sweep and historical conversation retrieval. It is deliberately grouped by role; entries are not all recommendations.

### 4.1 Agent runtimes, orchestration and workflow engines

- **OpenClaw** — personal assistant gateway, channels, replaceable model harnesses, device companions. Owner repository: https://github.com/LAURENCE1977/openclaw. Study gateway/channel/device boundaries; do not replace AEGIS identity, Sentinel or canonical memory.
- **Xiryn** — local-first persistent multi-agent runtime, Docker workstations, browser, routines and squads. https://github.com/SouravBeraAkaSpeed/xiryn. High-value architecture reference; not a wholesale replacement.
- **OpenHarness** — multi-machine coding-agent command centre. https://github.com/autonomous-ai/openharness. Study remote worker lifecycle and coordination.
- **Mercury Agent** — persistent local daemon, scoped memory, bots, scheduler and permissions. https://github.com/cosmicstack-labs/mercury-agent. Selective patterns only.
- **Rune / Rune-kit** — coding-agent workflows, skill mesh, TDD, verification, cross-session state and multi-host skill compilation. Rune: https://github.com/dybala-21/rune ; Rune-kit: https://github.com/Rune-kit/rune. These are distinct projects. Study quality/evidence gates and reusable workflow skills; do not import a second orchestrator.
- **RuFlo** — multi-agent orchestration, memory, MCP, swarms and RAG. https://github.com/ruvnet/ruflo. Architecture reference only pending exact version, runtime, security and cost review.
- **Luvus** — multi-agent coordination, Git worktrees, task dependencies, path locks and quality/merge gates. Exact repository identity/URL still needs confirmation.
- **AgenticOS** — governed-agent architecture, shared knowledge, budgets, approvals and audit. https://github.com/vstorm-co/agenticos. Reference, not a runtime dependency.
- **OpenDots** — CopilotKit agent workspace with persistent specialists, Spaces, memory permissions, MCP and approval cards. https://github.com/CopilotKit/OpenDots. UX/workspace reference; hosted/local runtime requirements must be considered.
- **OpenMuse (CopilotKit)** — early personal-agent app with mobile clients, task worker and browser worker. https://github.com/CopilotKit/openmuse. Research only.
- **OpenMuseAgent / nanoMuse** — corrected project identity; original archived and moved to https://github.com/nano-muse/nanoMuse. Keep distinct from CopilotKit OpenMuse.
- **Open WebUI** — self-hosted AI interface/RAG. https://github.com/open-webui/open-webui. Separate application; current branding-protection licence condition makes it unsuitable to fork/white-label.
- **LibreChat** — self-hosted chat/agent workspace; reviewed in PR #194. Deployment stack is heavier than the existing Workers/PWA architecture.
- **n8n** — workflow automation; https://github.com/n8n-io/n8n. Sustainable Use License, not OSI open source; not a core dependency.
- **Activepieces** — integration/workflow framework; https://github.com/activepieces/activepieces. MIT community edition; possible connector reference, but avoid duplicate workflow runtime.
- **Temporal** — durable workflow platform; https://github.com/temporalio/temporal. Strong durability reference but separate server/worker infrastructure.
- **Hatchet** — background tasks and durable workflows; https://github.com/hatchet-dev/hatchet. Separate infrastructure.
- **Trigger.dev** — TypeScript durable jobs; https://github.com/triggerdotdev/trigger.dev. Self-hosting adds operational overhead.
- **Inngest** — event-driven durable functions; https://github.com/inngest/inngest. Component licences differ; verify exact server/SDK.
- **Kestra** — declarative event orchestration; https://github.com/kestra-io/kestra. Java/database footprint is too heavy for current core.
- **Windmill** — scripts/workflows/apps; https://github.com/windmill-labs/windmill. AGPLv3 core and separate worker infrastructure.
- **Apache Airflow** — data DAG orchestration; https://github.com/apache/airflow. ETL reference, not interactive agent runtime.
- **Harness Router** — next-tool selection reference; https://github.com/Protocol-Lattice/harness-router. Selection only; AEGIS must retain policy and execution.
- **ToGO / ai-agno** — Go adapter to an Agno sidecar; https://github.com/togo-framework/ai-agno. Low priority due to runtime mismatch.
- **Blackbox AI Agents** — hosted coding-agent API and sandbox workflow. Service, not a core repo dependency.
- **Agency Agents** — specialist agent definitions; https://github.com/msitarzewski/agency-agents. Adapt roles/checklists with provenance; personas never grant permissions.
- **Addy Osmani Agent Skills** — engineering workflow skills; https://github.com/addyosmani/agent-skills. Selectively adapt practices; compare against existing Superpowers-derived skills.
- **Charlie Automates Skills** — workflow skills; https://github.com/LAURENCE1977/charlieautomatesskills. Selective workflow-pattern source; independently verify licence file.
- **OpenOutreach** — B2B lead/outbound agent; https://github.com/eracle/OpenOutreach. Not core; paid data/credits and external email effects conflict with free-first and approval constraints.

### 4.2 Browser, phone and computer-use control

- **Auto Browser** — owner repository https://github.com/LAURENCE1977/auto-browser; upstream identity is LvcidPsyche/auto-browser. MIT. MCP-native Playwright controller, reusable auth profiles, human takeover, approvals, audit and signed Witness receipts. Strongest browser-control reference. Integrate only behind Sentinel and AEGIS device/session policy.
- **Vercel agent-browser** — https://github.com/vercel-labs/agent-browser. Potential lightweight browser automation adapter; compare against Auto Browser before adopting both.
- **Machine Control** — https://github.com/kzahel/machine-control. MIT. Candidate target-native adapter for Android/ChromeOS/desktop. PR #202 recommends this as the leading device adapter, but no code is vendored and no commands are enabled.
- **Open-AutoGLM** — https://github.com/zai-org/Open-AutoGLM. Apache-2.0 phone-agent candidate using visual understanding and ADB. Isolate behind a local device broker; no public ADB or uncontrolled actions.
- **Google ARTEMIS** — https://github.com/google/artemis. Android UI automation research/adapter candidate; compare with Open-AutoGLM and Machine Control.
- **Meet Nod** — https://github.com/n8n-io/nod. Browser/workspace computer-use architecture reference.
- **Agent S** — evaluated in PR #125 as computer-use candidate; exact source/commit must be checked in its research record before adoption.
- **CoreDeck** — https://github.com/devmuaz/CoreDeck. MIT Android SDK/ADB/emulator desktop utility; optional QA tooling, not a phone agent.
- **AndroidWorld** — https://github.com/google-research/android_world. Apache-2.0 benchmark/test bench, not execution engine.
- **Brain2Qwerty** — specialist BCI research, not practical general-purpose phone/computer control.
- **HA-MCP** — Home Assistant integration, useful only for authorised smart-home workflows; not general device control.

### 4.3 Memory, knowledge graphs, retrieval and data

- **Graphify** — local code/dependency knowledge graphs, MCP and change-impact analysis; Apache-2.0 per historical review. Exact canonical URL needs recovery. Optional Forge/code-intelligence subsystem.
- **Kytheros Strata** — https://github.com/kytheros/strata. Local-first memory architecture using SQLite/FTS5 and Workers/D1 adapter patterns. Rebuild/selectively adapt; AEGIS remains canonical memory owner.
- **Niko1221 Strata** — https://github.com/Niko1221/Strata. Separate local inference project; do not confuse with Kytheros memory project.
- **LlamaIndex** — https://github.com/run-llama/llama_index. Python retrieval/data framework; optional external worker if measured need exists.
- **LlamaIndexTS** — https://github.com/run-llama/LlamaIndexTS. Deprecated; do not adopt.
- **SereneDB** — reviewed in PR #194 as possible lexical/vector/hybrid retrieval backend; separate service and licence/runtime review required.
- **JSON Crack** — https://github.com/AykutSarac/jsoncrack.com. Schema/JSON graph visualisation idea for a future Developer Console; current licence for moved code was not verified.
- **free-for.dev** — https://github.com/ripienaar/free-for-dev. Free-tier discovery index, not an authority; repository licence was not found in the historical inspection.
- **Awesome MCP Servers** — https://github.com/punkpeye/awesome-mcp-servers. Discovery directory only; every listed server requires independent review.
- **Dev.to** and **Stack Overflow** — community evidence sources, not software dependencies. Attribute and verify against primary sources.
- **Build Your Own X** — https://github.com/codecrafters-io/build-your-own-x. Learning/reverse-engineering index; each linked tutorial needs its own review.

### 4.4 Model serving, routing and evaluation

- **G0DM0D3** — owner repository https://github.com/LAURENCE1977/G0DM0D3; upstream https://github.com/elder-plinius/G0DM0D3. AGPL-3.0. Multi-model comparison, local-only mode and provider UX. Study behaviour only; do not copy AGPL-covered code into AEGIS without a deliberate licence decision.
- **Rune** — local coding agent with evidence gates and local model support; distinct from Rune-kit. https://github.com/dybala-21/rune.
- **AirLLM** — storage-layer model loading for constrained GPU memory; exact historical repository URL not preserved. Optional inference research, not Cloudflare runtime.
- **FlashML FreeToken** — https://github.com/FlashML-org/FreeToken. Local inference/model-serving candidate; benchmark only on suitable hardware.
- **vLLM** — https://github.com/vllm-project/vllm. Apache-2.0 inference server; future provider endpoint, not Chromebook/Workers dependency.
- **Hugging Face Transformers** — https://github.com/huggingface/transformers. Apache-2.0 library; Python/PyTorch/hardware footprint makes it unsuitable for Worker/browser core.
- **Niko1221 Strata** — local model serving adapter candidate; separate from Kytheros Strata memory.
- **LM Studio** — local model service and OpenAI-compatible API/SDK/CLI; PR #179 recommends a generic AEGIS HTTP adapter rather than importing the full SDK.
- **Ollama** — local model service; adapter candidate subject to user-owned compute and model licences.
- **OpenRouter** — hosted model gateway; only use if a genuinely free allowance is verified for the exact model/task; no silent paid fallback.
- **AxForge, APInex, Groq, Gemini, Mistral, Anthropic, xAI/Grok, Venice** — provider/API candidates, not repositories to merge. Route through the same provider interface and Infinity Zero cost/policy gate.
- **BitNet.cpp** — local quantized inference candidate; hardware and build requirements need testing.

- **DeepSeek V4.1 Flash Uncensored** — add as a distinct, third-party model variant, not an official DeepSeek release. Candidate checkpoints include `dealignai/DeepSeek-V4.1-Flash-UNCENSORED-FP8` and `OpenUncensored/DeepSeek-V4.1-Flash-1017-Uncensored`. The OpenUncensored card describes an approximately 763B-parameter checkpoint and reports 8×H200 inference; another service advertises an OpenAI-compatible hosted endpoint, but its licence forbids reselling/proxying and therefore cannot be treated as a general AEGIS provider. No hosted endpoint is assumed free. Keep this model in a quarantined experimental profile with no tool permissions; Sentinel, approval, budget and audit checks remain mandatory. Verify model provenance, checkpoint revision, exact licence, provider retention, region, pricing and benchmark quality before any pilot. Sources: https://huggingface.co/dealignai/DeepSeek-V4.1-Flash-UNCENSORED-FP8 ; https://huggingface.co/OpenUncensored/DeepSeek-V4.1-Flash-1017-Uncensored ; https://huggingface.co/heabsy/DeepSeek-V4.1-Flash-1017-Uncensored-Fast

- **9Router** — https://github.com/Raisolah/9router. Historical security hold; review advisories and exact fixes before reconsideration.
- **OmniRoute** — optional routing reference from early ODIN integration research; not required if it compromises the free Cloudflare architecture.
- **Agent Lightning** — https://github.com/microsoft/agent-lightning. RL/training framework, not general agent runtime; high compute burden.
- **LangChain.js** — https://github.com/langchain-ai/langchainjs. Broad framework; reference/integration only to avoid duplicating native AEGIS orchestration.
- **Vercel AI SDK** — https://github.com/vercel/ai. High-value provider/streaming interface reference; use selectively.

### 4.5 API, MCP, integration and developer tools

- **Composio** — hosted integration broker/service, not code to merge. AEGIS has a read-only connection inventory foundation; tool execution requires Sentinel, grants, approvals, audit and exact connection checks.
- **mcptoon** — https://github.com/activeing123/mcptoon. MCP/skill gateway candidate; review isolation, OAuth and sandbox boundaries.
- **Hoppscotch** — https://github.com/hoppscotch/hoppscotch. MIT API inspector/QA reference; avoid embedding the full monorepo.
- **DevToys** — https://github.com/DevToys-app/DevToys. Developer utility reference; optional local utilities, not core runtime.
- **BLA (Blind LLM Agents)** — https://github.com/qybaihe/bla. Defensive anti-reverse-engineering research; not core orchestration.
- **TruffleHog** — https://github.com/trufflesecurity/trufflehog. AGPL-3.0 since v3 per historical review; possible detection-only CI gate, with licence and data-handling review.
- **Firecrawl** — https://github.com/firecrawl/firecrawl. AGPL-3.0 core; optional web ingestion service only if permitted and cost-free for the exact use.
- **Oxylabs Web API** — https://github.com/oxylabs/web-api. Commercial hosted service; exclude under zero-spend rule.
- **v0** — https://github.com/vercel/v0-sdk. Design/build workflow reference, not AEGIS runtime.
- **Google Stitch skills** — https://github.com/google-labs-code/stitch-skills. Design-to-code/design-system workflow; generated code remains untrusted until reviewed.
- **Google AI Studio Build** — hosted build/prototype service; custom URL feature is not proof arbitrary custom domains can be attached. No DNS changes for experiments.
- **shadcn/ui, Kibo UI, Cult UI, 21st.dev, Chimera UI, Libraries.dev** — UI component/registry candidates. Direction recorded in PR #201: one coherent base (shadcn where React is appropriate), selectively layer compatible components; do not install competing systems together.
- **SolidCraft** — https://docs.solidcraft.io/. MIT OR Apache-2.0 per docs; optional parametric CAD/MCP/media capability, not core.
- **OpenCut** — https://github.com/OpenCut-app/OpenCut. Future media editor research; planned APIs/MCP/headless features must not be treated as currently available.
- **3D Website Builder** — owner repository https://github.com/LAURENCE1977/3D-Website-Builder. React/Vite/Three.js portfolio builder; no README/licence found in inspected root and older dependencies. Keep optional, do not import before licence/dependency review.

### 4.6 Other research, specialised or ambiguous candidates

- **Locally Uncensored** — https://github.com/PurpleDoubleD/locally-uncensored. AGPL-3.0 desktop AI studio; architecture reference only.
- **CyberDrop-DL** — https://github.com/Cyberdrop-DL/cyberdrop-dl. GPL-3.0 downloader; unrelated to Cloudflare D1 and not an AEGIS core dependency.
- **Open WebUI** and **OpenMuse** are separate projects; do not conflate them.
- **OSIRIS / Osirus**, **ARGUS**, **Godmode3** and similarly named projects require exact repository identity confirmation before any evaluation. The name alone is not sufficient.
- **Zero-Breach-Toolkit**, **Offgrid**, **Craft Anything**, **MiroFish**, **Heretic**, **Brain2Qwerty**, **HA-MCP**, **Embarko**, **Headroom**, **Machine Control** and **RuFlo** were discussed in later conversations. Their exact URLs, versions, licence and integration status must be recorded individually before adoption. Headroom has a separate assessment in PR #202; Embarko is a deployment service candidate, not a repository merge.
- **Rune-kit** and **Rune** are distinct. **Kytheros Strata** and **Niko1221 Strata** are distinct. **OpenMuse** has at least two distinct projects. **Harness Router** and **Harness.io** are distinct. Resolve ambiguous names before any action.

### 4.7 Owner-controlled repositories

The linked GitHub account inventory returned nine repositories:

- `LAURENCE1977/Aegis-` — canonical AEGIS project.
- `LAURENCE1977/openclaw` — owner-held OpenClaw repository/fork.
- `LAURENCE1977/auto-browser` — owner-held Auto Browser repository/fork.
- `LAURENCE1977/G0DM0D3` — owner-held G0DM0D3 repository/fork.
- `LAURENCE1977/3D-Website-Builder` — optional visual builder.
- `LAURENCE1977/charlieautomatesskills` — workflow skill collection.
- `LAURENCE1977/storie-audio-lab-3` — empty at the recorded sweep.
- `LAURENCE1977/storie-audio-lab-store-checker` — root HTML only at the recorded sweep.
- `LAURENCE1977/storied-gecko-09ca7c` — root HTML and GitHub Actions folder at the recorded sweep.

The account inventory response contained nine repositories, including the AEGIS canonical repo. Reconcile this list on the next live inventory refresh.

## 5. Overlap and consolidation decisions

| Capability area | Competing candidates | AEGIS decision |
|---|---|---|
| Core identity, policy, approvals, audit | AEGIS/Sentinel vs OpenClaw, Mercury, AgenticOS, OpenHarness | Keep AEGIS/Sentinel canonical |
| Durable jobs/orchestration | AEGIS Worker/D1/Queue vs Temporal, Hatchet, Trigger.dev, Inngest, Kestra, Windmill, Airflow, n8n, Activepieces | Keep current runtime; benchmark before any replacement |
| Agent planning/workflows | ODIN vs RuFlo, Xiryn, Rune, Rune-kit, Mercury, Luvus | Keep ODIN; selectively adapt patterns/skills |
| Browser control | Auto Browser vs agent-browser, Machine Control, OpenClaw browser, Nod | Auto Browser is leading browser reference; Machine Control is target adapter candidate; avoid duplicate controllers |
| Phone control | Machine Control vs Open-AutoGLM vs Google ARTEMIS | One device broker; compare adapters against Android first |
| Model routing | Native provider registry vs OmniRoute, 9Router, G0DM0D3 | Keep one native router and provider contract |
| Memory/retrieval | Native memory/Project Spaces vs Graphify, Strata, LlamaIndex, SereneDB | Keep canonical AEGIS memory; optional indexes/retrievers only |
| UI/workspace | AEGIS Control Centre vs LibreChat, Open WebUI, OpenDots, OpenMuse | Keep one AEGIS UI; borrow interaction patterns |
| Web research | Forge vs Firecrawl, Oxylabs, browser agents | Forge owns provenance; ingestion adapters are optional and cost/terms gated |
| Security scanning | Sentinel vs TruffleHog, BLA, external scanners | Sentinel policy remains canonical; scanners provide evidence only |
| Creative/media | AEGIS Media Studio vs OpenCut, SolidCraft, 3D builder | Separate optional worker; not core runtime |

## 6. Recommended architecture after consolidation

1. **One control plane:** AEGIS owns identity, owner principal, policy, approvals, secret references, audit, task state, quotas and revocation.
2. **One intelligence plane:** ODIN plans tasks, chooses models/providers, retrieves approved memory and proposes specialist work.
3. **One execution boundary:** Sentinel checks the exact principal, capability manifest/version, resource, connection, input digest, grant, approval, budget and expiry before an adapter can act.
4. **One Forge catalogue:** every repository/API/MCP/model/service has a pinned source, source type, licence evidence, maintenance/security notes, capabilities, costs, dependencies, fit, overlap and decision.
5. **One provider contract:** OpenAI-compatible and vendor-specific transports plug into one registry; cost and data policy remain outside the adapter.
6. **One device bridge:** Android and Chromebook are separate enrolled targets with per-device credentials and explicit capability allowlists. Start read-only; no generic shell.
7. **One durable runtime:** Worker/D1/Queue remains the first bounded engine. Cloudflare quotas and actual account bindings must be verified before relying on it.
8. **Optional workers:** browser, local inference, retrieval, CAD/media, voice and computer-use agents run out of process behind versioned contracts. They are replaceable and never become policy authorities.

## 7. Prioritised action plan

### P0 — reconcile before adding more features

- Build a PR/branch ledger for #1–#202, including merged commit, closed-unmerged/superseded state, base/head ancestry and latest CI.
- Identify the missing #102 API record.
- Compare current `main` against all open branches and identify which PRs are still relevant, stale, duplicate or already represented elsewhere.
- Rerun tests on the exact latest intended integration head; do not rely on old green checks.
- Verify Cloudflare account identity, plan, Pages project, D1 bindings, Queues and Worker deployment in read-only mode before any deployment proposal.

### P1 — finish the existing core

- Reconcile the current stacked chain #200 → #201 → #202 and decide a safe merge order only after branch-drift and CI checks.
- Keep the zero-cost router and quota ledger fail-closed.
- Complete provider adapter/registry consistency and eliminate duplicate provider branches.
- Complete owner identity derivation and ensure every connection/grant/approval is owner-scoped.
- Finish device token rotation, replay protection and stop/revocation semantics before device actions.

### P2 — add the repository intelligence catalogue

- Persist every candidate from this document as a Forge candidate record with canonical URL and immutable revision.
- Mark candidates `verified`, `candidate`, `ambiguous`, `service-not-repo`, `deprecated`, `licence-hold` or `rejected`.
- Verify current licence, maintenance, security advisories, dependencies, runtime fit, hardware requirements and free-tier costs.
- Score capability value, reliability, security, compatibility, cost, integration effort and licence risk.
- Record one of: `reuse`, `adapt`, `rebuild`, `connect`, `reference-only`, `defer`, `reject`.

### P3 — controlled pilots

Only after the P0 reconciliation:
- Auto Browser read-only browser observation pilot behind Sentinel.
- Machine Control read-only device discovery pilot on one explicitly paired Android/Chromebook target.
- One optional local inference provider on user-owned hardware, with no hosted spend.
- One retrieval/index adapter only if benchmarks show native memory is insufficient.

No candidate code is copied or executed in the AEGIS control plane as part of this audit.

## 8. Final judgement

The project does not need another wholesale agent framework. The architecture already contains the right building blocks: AEGIS control plane, ODIN intelligence, Sentinel governance, Forge research, a durable job runtime, Project Spaces, provider adapters and device bridge foundations.

The real risk is **branch fragmentation and capability duplication**, not lack of another repository. The next highest-value work is to reconcile the PR stack, establish a verified source-of-truth inventory, finish the security and cost boundaries, then integrate only the best external adapters where a real gap remains.

This audit is intentionally conservative: a candidate is not an integration; a draft is not a merge; a passing historical test is not current verification; and a device API is not live phone control.

## 4.8 Additional candidate review — 23 November 2026

These four names were added after the main inventory. The classifications below are deliberately conservative and do not imply installation or execution.

- **BLA — Blind LLM Agents** — https://github.com/qybaihe/bla. MIT-licensed defensive MCP/CLI project aimed at hardening software release artefacts (JavaScript/TypeScript, Electron ASAR, WASM, Python, native binaries, SQLite, model weights and Android DEX) against AI reverse-engineering agents. It is not an agent orchestration framework and does not make an LLM “blind” inside AEGIS. Potential fit: optional Forge/release-security analysis for AEGIS-owned distributables, source-map/symbol exposure checks and controlled release hardening. Treat its canary/decoy/resource-exhaustion techniques as untrusted until independently tested for runtime equivalence, reproducible builds, false positives, performance and legal/security impact. Do not let its MCP tools bypass Sentinel; start with read-only audit/benchmark on disposable artefacts. Decision: **reference / possible isolated security pilot**, not core runtime. Source describes MIT licensing and its stated defensive scope; benchmark claims are project-reported, not independent certification.

- **Freebuff** — https://github.com/CodebuffAI/freebuff. Free coding-agent product family (CLI, desktop, web, cloud and chat) built on Codebuff's multi-agent framework. The project advertises free access supported by advertising, with a daily hour allowance and model availability varying by region, product and capacity; it is not unlimited compute. The repository describes parallel agents, codebase mapping, implementation/review, browser research and hosted workspaces. Potential fit: an external coding/research workbench or comparative benchmark for ODIN specialist workflows, not a replacement for AEGIS runtime or Sentinel. Important boundary: the CLI/agents/SDK are open-source (the product's current materials describe Apache-2.0 for these components), while desktop/backend are not all open source; the service processes prompts, traces and project files, and its privacy disclosures allow data use for training/ad personalisation in cases where the model/feature notice permits it. Never connect the canonical AEGIS repository or sensitive secrets until data handling, regional free limits, code execution permissions and retention are reviewed. Do not make Freebuff a required dependency. Decision: **optional external comparison only; privacy and access-tier hold before connecting AEGIS**.

- **Abacus AI SuperComputer** — https://supercomputer.abacus.ai/. Hosted Ubuntu VM/SSH/cloud-compute environment with databases, storage, model hosting and persistent agent workloads. It is technically capable, but it conflicts with the user's hard zero-cost constraint: official product information advertises a paid Pro subscription (help page states $20/month) and SuperComputer runtime consumes credits (one credit per five minutes while running); model/API calls consume subscription credits separately. A promotional first-month price is not a free tier. Decision: **exclude from AEGIS infrastructure** unless the user explicitly changes the no-spend rule; do not sign up, launch a VM or connect GitHub.

- **Hellboy** — identity unresolved. Search surfaced several unrelated projects under the Agent-Hellboy GitHub account, including Agent-Hellboy/mcp-runtime (a Kubernetes-native MCP server manager/registry/broker with per-tool policy enforcement; its release notes identify it as alpha) and Agent-Hellboy/fmsh (a macOS eBPF-based machine activity recorder, not a general agent). Neither can safely be assumed to be the item intended. If the intended item is mcp-runtime, its governance/gateway ideas overlap with AEGIS/Sentinel and its Kubernetes dependency is a poor fit for the current Cloudflare Workers-first stack; reference only, do not add a second policy authority. If it is fmsh, it is macOS-specific and not suitable for the user's Android/Chromebook setup. Decision: **ambiguous—hold pending exact URL**.

### Consolidated decision
Of these four, BLA has the clearest potential value as an optional release-security check, while Freebuff is useful as an external benchmark/workbench only after privacy review. Abacus is ruled out by the zero-spend rule. Hellboy remains unclassified until its exact source is confirmed. None should be merged into the AEGIS control plane or granted execution authority.

## 4.9 Secure access and Android phone-control candidates — 23 November 2026

- **Google ARTEMIS** — https://github.com/google/artemis. Apache-2.0 Android automation toolkit with a Python 3.12+ host, ADB-connected Android phone or emulator, web console, CLI and native MCP server. Supports natural-language cross-app workflows, screen/accessibility inspection, screenshots, traces and diagnostics; the repository describes Flash and Pro execution profiles. This is a genuine phone-control engine, unlike a VPN or remote-access gateway. It can potentially drive the user's Android phone once installed on a compatible host and explicitly paired over USB debugging. **Host requirement is the main practical blocker:** the project documents macOS/Linux and Windows startup paths; it does not document ChromeOS as a supported host. A Chromebook Linux development environment might work, but USB ADB passthrough, Python/uv, ADB and scrcpy compatibility must be verified non-destructively first. Do not assume it works directly inside the ChatGPT Android app or that the assistant has live phone access. Decision: **top Android-control pilot**, starting with read-only device state/screenshots, then harmless allowlisted UI tasks.

  - AEGIS integration boundary: ARTEMIS MCP must run as a separately authenticated device worker behind the AEGIS device bridge. Treat its MCP methods as privileged capabilities, not as direct model tools. ODIN proposes an exact task; Sentinel validates enrolled device, app/action allowlist, owner approval, expiry, task/input digest and audit before dispatch. Start with observation; require confirmation for sending messages, purchases, account/security settings, deletion, payments, or other external effects. Never expose ADB, ARTEMIS MCP or its local web console directly to the public internet. Disable USB debugging/revoke the host authorisation when the pilot is finished if ongoing use is not needed.

- **Pangolin** — https://github.com/fosrl/pangolin. WireGuard-based zero-trust access platform combining private-resource access, reverse proxy and identity-aware AI gateway. Community Edition is self-hostable and AGPL-3.0; Pangolin Cloud Basic is advertised as free, with paid cloud/team tiers. It is a secure connectivity/access layer, **not a phone automation engine**: it cannot itself inspect or tap Android screens. Potential AEGIS use: private access to an ARTEMIS host/UI or AEGIS admin endpoints without exposing them publicly, and optionally an identity-aware route to model services. Pangolin requires a reachable control-plane deployment or hosted account plus connector/host infrastructure; a free software licence does not make the hosting compute/domain free. The free Cloud Basic feature set, resource limits, account terms, data path and exact routing requirements must be checked before relying on it. Decision: **promising optional secure-access layer**, only if it fits the free-tier budget and does not duplicate existing Cloudflare access controls.

### Recommended ARTEMIS + Pangolin topology

1. Android phone — enrolled by the user; USB debugging/ADB to one trusted host during the first pilot.
2. ARTEMIS host — runs on a compatible Chromebook Linux environment or another user-controlled host; no assumption of Chromebook USB passthrough until tested.
3. AEGIS device bridge — device identity, heartbeat, revocation and task assignment; no generic shell.
4. Sentinel — authorises each bounded action and records the audit event; ARTEMIS does not become a policy authority.
5. Pangolin (optional) — protects private access to the ARTEMIS host and AEGIS services; never publishes raw ADB or an unauthenticated MCP endpoint.

### Pilot sequence and stop conditions

- First confirm the exact host can see the phone via ADB without changing phone security settings beyond user-approved USB debugging.
- Run ARTEMIS device status and screenshot/read-only observation only; inspect exactly what the helper/accessibility service installs and what data leaves the phone.
- Test a harmless UI task (for example, open Settings and read battery level) with the user watching.
- Only then design the AEGIS adapter and Sentinel policy; no unattended broad app control.
- Stop if the host requires paid hosting, an unknown binary, public ADB, broad accessibility permissions without a clear purpose, or a security-policy bypass.

Official sources: https://github.com/google/artemis ; https://github.com/fosrl/pangolin ; https://pangolin.net/faq

## 2026-11-23 candidate review — Tolaria, Hexabot, libSQL, Reflex, Infisical, SurvivalLLM, Perplexica/Vane, Continue, Flowise, AnythingLLM, Danswer/Onyx and Reor

This is a triage pass for AEGIS Infinity, not an instruction to install or integrate all candidates. Preserve the existing AEGIS control plane, ODIN orchestration, Sentinel enforcement, Cloudflare D1 runtime and free-first constraint.

| Candidate | Verified role / licence or status | AEGIS decision |
|---|---|---|
| **Tolaria** — https://github.com/refactoringhq/tolaria | Local-first desktop Markdown knowledge base; Git-backed vault; MCP server; supports local CLI agents and direct model targets. AGPL-3.0-or-later. Safe mode limits vault tools; Power User mode can expose local shell commands scoped to the vault. | **Strong knowledge-workflow reference; optional external vault pilot only.** Its Markdown/Git/MCP model is useful for a portable operator knowledge base and human-reviewable agent memory. Do not replace AEGIS owner-scoped memory or put secrets in the vault. AGPL and desktop/runtime requirements need review; it is not a ready-made Chromebook/phone runtime. |
| **Hexabot** — https://github.com/hexabot-ai/Hexabot | AI workflow/chatbot automation runtime with agents, actions and channels; TypeORM, SQLite local and PostgreSQL production. Repository identifies FCL-1.0-ALv2 (Fair Core License). | **Reference only; do not embed.** It overlaps ODIN orchestration and adds a separate runtime. FCL is source-available with competing-use restrictions and delayed Apache-2.0 conversion; not equivalent to permissive Apache/MIT. Study channel/action patterns only. |
| **libSQL** — https://github.com/tursodatabase/libsql | MIT-licensed SQLite fork with embedded replicas and remote access; distinct from Turso Database. Its upstream README says new features are being developed in Turso and libSQL retains SQLite's single-writer model. | **No database migration.** AEGIS already targets Cloudflare D1; replacing it adds migration and operational risk without solving a demonstrated need. Revisit only for a specific local/offline replica requirement, after testing consistency and D1 compatibility. |
| **Reflex** — https://github.com/reflex-dev/reflex | Apache-2.0 full-stack web-app framework in Python; Python 3.11+ according to current package metadata. | **No adoption for current UI.** It would introduce a second frontend/backend stack and Python runtime, duplicating the existing application. Useful only for a separate Python-native prototype, not a rewrite. |
| **Infisical** — https://github.com/Infisical/infisical | Open-source secrets/certificates/access platform; core repository MIT, with `ee` directories under separate enterprise licensing. Includes CLI secret scanning for repositories and history. Self-host quick start requires Docker. | **Use the secret-scanning capability as a comparison/checklist; do not add a second vault yet.** AEGIS already has a governed vault/secret-resolution design. A second secrets control plane would increase blast radius and operations. Any future evaluation must compare current free self-host scope, enterprise boundaries, backup/recovery and secret exposure. Never migrate or upload real secrets during a pilot. |
| **SurvivalLLM** | Exact project/repository could not be reliably identified from the supplied name in this pass. | **Unverified — no integration decision.** Need exact URL or screenshot; do not infer which project this is. |
| **Perplexica** — former project name; current upstream appears under **Vane** | Perplexica was an AI search/answer engine; current project references indicate the upstream was renamed Vane during 2026. Search result evidence also includes independent forks still named Perplexica, so fork identity matters. | **Research-interface reference only.** Do not install a stale Perplexica fork by name. If evaluating, verify the canonical Vane repository, current licence, maintenance and provider/data flow first. AEGIS already has research/provider adapters; avoid duplicating the search control plane. |
| **Continue** — https://github.com/continuedev/continue | Open-source coding agent (CLI, VS Code, JetBrains); Apache-2.0. Its own repository notice says the repository is no longer actively maintained and is read-only after the final 2.0 release. | **Do not select as a new production coding agent.** Retain as historical reference for IDE/CLI agent UX and configuration patterns only. |
| **Flowise** — https://github.com/FlowiseAI/Flowise | Visual agent/workflow builder; Apache-2.0. Upstream announced wind-down, code freeze and archive on 13 August 2026; security reporting/support sunset followed. | **Exclude from live AEGIS integration.** Do not introduce an archived workflow runtime with no active upstream security support. Historical visual-builder patterns may inform internal tooling, but no dependency. |
| **AnythingLLM** — https://github.com/Mintplex-Labs/anything-llm | MIT-licensed local-first AI workspace with RAG, agents, multiple model providers and vector-store options. Self-host security is the operator's responsibility; some model assets may be fetched from vendor CDN unless manually supplied. | **External benchmark / optional isolated sandbox only.** Broad overlap with ODIN, memory and provider routing; not a replacement. Could be useful to compare document ingestion, workspace UX and local model support. Never connect the canonical repo or secrets without a data-flow review. |
| **Danswer / Onyx** — https://github.com/onyx-dot-app/onyx | Enterprise search and RAG across company applications. Repository is mixed-license: most non-`ee` content MIT; `ee` directories use Onyx Enterprise License. Connectors ingest/index documents; permission sync is Enterprise Edition. | **Connector and retrieval reference only.** Useful for source sync, document permissions and indexing patterns, but a full deployment adds PostgreSQL, Redis, search/indexing and worker operations. Do not assume every connector or permission feature is free/MIT. |
| **Reor** — https://github.com/reorproject/reor | Local-first AI personal knowledge management; Markdown/filesystem notes, Ollama and OpenAI-compatible model support. AGPL-3.0. | **Reference only; lower priority than Tolaria.** Similar knowledge-base overlap, with desktop/local model requirements. Avoid running two competing memory vaults; compare retrieval and local-model UX, not merge code. |

### Consolidated recommendation

1. **Keep AEGIS as the system of record and orchestrator.** None of these candidates justifies replacing AEGIS, ODIN, Sentinel or the existing D1 control plane.
2. **Highest-value research:** Tolaria for Git-backed, human-inspectable agent knowledge; Infisical for secret-scanning practices; Onyx for permission-aware enterprise retrieval; AnythingLLM for local RAG/agent UX.
3. **Do not adopt:** Flowise (archived/sunset), Continue (read-only), Hexabot (runtime overlap plus FCL restrictions), Reflex (stack duplication), or libSQL (no demonstrated database need).
4. **Identity check required:** SurvivalLLM and canonical Vane/Perplexica repository. No guessed URLs, installs or licences.
5. **No installation, external account, paid service, secret transfer, production migration or deployment was performed as part of this review.**

Source review links: https://github.com/refactoringhq/tolaria ; https://github.com/hexabot-ai/Hexabot ; https://github.com/tursodatabase/libsql ; https://github.com/reflex-dev/reflex ; https://github.com/Infisical/infisical ; https://github.com/continuedev/continue ; https://github.com/FlowiseAI/Flowise ; https://github.com/Mintplex-Labs/anything-llm ; https://github.com/onyx-dot-app/onyx ; https://github.com/reorproject/reor .
