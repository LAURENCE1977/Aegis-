# AEGIS product experience and repository research

**Date:** 16 November 2026  
**Purpose:** Record what has actually been inspected in Laurence's repositories and supplied references, and how the findings should influence the AEGIS interface. This is a selective design/architecture review, not a claim that every supplied repository has been fully audited.

## Product direction

AEGIS should feel like a contemporary, human-centred operating environment rather than a chat page with a dark theme. Its primary signed-in surface is a companion-led Home experience, with dedicated workspaces for conversation, projects, memory, Forge, approvals and security.

The 3D companion is a progressive presentation tier, not a prerequisite for a modern product. The base experience must already feel complete and polished with a static or lightweight 2D presentation.

## Laurence's repositories inspected

| Repository | Evidence inspected | Findings and AEGIS use |
|---|---|---|
| [3D-Website-Builder](https://github.com/LAURENCE1977/3D-Website-Builder) | `package.json`, `src/App.tsx`, `src/components/PortfolioPreview.tsx` | React 18, React Three Fiber, drei, Three.js, Framer Motion and Lucide. Strong reference for separating a 3D scene from overlay content, motion-led transitions and reusable visual components. Its root README and LICENSE were not found in this inspection, so do not copy or import its source/assets until provenance and licence are established. |
| [G0DM0D3](https://github.com/LAURENCE1977/G0DM0D3) | `README.md`, `package.json` | Next.js/React interface with Framer Motion, Lucide, multiple model-provider options, local-model support and local conversation history. Root licence is AGPL-3.0. Use as a feature/pattern reference only for now; do not transplant code or dependencies without a deliberate AGPL compatibility decision and third-party notice review. Provider credentials in browser storage are not a pattern to copy into AEGIS. |
| [openclaw](https://github.com/LAURENCE1977/openclaw) | `README.md`, `LICENSE` | MIT. Useful reference for gateway/control-plane separation, channels, companion device nodes, replaceable model providers, user-owned state and tool/skill boundaries. Its README warns that main-session tools can run on the host unless sandboxing is configured. AEGIS must keep Sentinel as its sole policy authority and never inherit ambient host access. |
| [auto-browser](https://github.com/LAURENCE1977/auto-browser) | `README.md`, `LICENSE` | MIT. Useful for operator-visible browser sessions, human takeover, explicit approvals, audit events, receipts and local-first deployment. Any future AEGIS browser adapter must remain behind Sentinel, scoped grants and visible human control. |
| [storied-gecko-09ca7c](https://github.com/LAURENCE1977/storied-gecko-09ca7c) | Installed-repository metadata | Recognised as an owner repository; no source-level UI review completed in this pass. |
| [storie-audio-lab-store-checker](https://github.com/LAURENCE1977/storie-audio-lab-store-checker) | `index.html` opening section | Contains a bundled single-page interface and custom Optimistic/Optimistic Mono font references. Potential reference for typography and a compact single-page deployment, but no code/assets should be reused without a full source and licence review. |
| [storie-audio-lab-3](https://github.com/LAURENCE1977/storie-audio-lab-3) | Repository metadata | Repository was reported empty when the README was requested; no implementation available to reuse. |

## Other user-supplied upstream candidates already recorded in the research register

These are architecture and capability references, not automatically approved dependencies:

- **Agent/workspace and companion UX:** CopilotKit/OpenBot, AnythingLLM, OpenClaw, CowAgent, Hermes Agent, OpenHands, Pi Herdsman.
- **Security and execution boundaries:** Octomind, IronClaw, OpenWorker, Trail-Code, TruffleHog, Harness.
- **Interoperability and gateways:** MCPHub, Goosio, OpenZiti MCP Gateway, uni-mcp-gateway, MCP, AG-UI, A2A.
- **Automation and durable orchestration:** Activepieces, n8n, Kestra, Temporal, Windmill, Trigger.dev, Hatchet, Apache Airflow.
- **Research, discovery and external data:** Firecrawl, Oxylabs, Open Outreach, Public APIs catalogue, Dev.to, Stack Overflow, Frontend Mentor.
- **Identity, storage and ecosystem:** PocketBase, Twenty, Open Dots, Agency Agents, SolidCraft and Google Artemis.

Names such as Scrappy and Huggin were previously supplied but remain unresolved to exact repository identities. Do not guess which project the user meant.

The existing `AEGIS_UPSTREAM_RESEARCH_2026-11-16.md` remains the source of truth for the wider build/adapt/connect/reject register, licence evidence, candidate status and adoption gates. This document only records the subset reviewed for product experience and companion architecture.

## Design principles extracted

1. **Composition over decoration.** Use a clear information hierarchy, meaningful workspace areas, purposeful empty states and visible next actions. Gradients and glow are accents, not the product.
2. **Companion-first, not avatar-only.** The companion is a first-class experience layer over the shared AEGIS core. It must coexist with useful workspaces and never become a separate identity or permissions system.
3. **Progressive presentation.** Begin with polished responsive 2D/2.5D and text. Add Three.js/Babylon.js rendering behind a provider-neutral contract after real-device benchmarks.
4. **Motion with restraint.** Use transitions to clarify state and navigation, not constant animation. Honour reduced-motion and battery-saving settings.
5. **Consistent iconography and typography.** Prefer a coherent icon set and typography scale over mixed Unicode glyphs. Ensure icon-only controls have accessible names.
6. **Responsive by design.** Desktop may use a persistent navigation rail and multi-column workspace; mobile should become a compact, touch-friendly navigation and single-column flow without hiding essential controls.
7. **Local-first and transparent.** Model/provider settings, memory, history and data movement must show where information goes. Do not copy patterns that store API secrets in browser storage.
8. **Human oversight is visible.** Browser/computer operations, external tools and consequential actions must show exact scope, approval status, provenance and cancellation controls.
9. **Keep the core lightweight.** Do not pull entire upstream monorepos or heavyweight UI frameworks into the current AEGIS client without measured benefit. Use small, replaceable adapters and test on Chromebook, iPhone and iPad-class devices.
10. **Licence and provenance before reuse.** Review root and nested licences, dependencies, fonts, avatars, models and assets independently. Preserve notices. Unknown terms mean hold, not permission.

## Current implementation checkpoint

- A dedicated companion-led Home dashboard has been added to `index.html` and is now the default signed-in landing view.
- The companion presentation stage is on Home; Conversation is a separate focused workspace.
- Home shortcuts navigate to Conversation, Project Spaces, Memory, Knowledge Forge, Approvals and Security.
- The client remains dependency-light; no external paid service or new runtime dependency was added.
- The full Node.js/Miniflare and isolated D1/Forge CI run 43954785649 passed after the dashboard implementation.
- The Cloudflare Pages preview for commit `4d37eed7ebbb609cff7b5e2541cfb182a651e095` deployed successfully at https://a673ccea.aegis-6yk.pages.dev.
- The signed-in interface has not yet had authenticated end-to-end browser verification because the Preview environment's authentication secrets are not configured. A client-side visual simulation is not a substitute for an authenticated test.
- The current avatar is still a disclosed static placeholder. No claim is made that a real human avatar, 3D renderer, speech engine or profile customisation is complete.

## Next experience-engineering steps

1. Complete desktop/mobile visual QA of the Home and Conversation layouts, then fix measured defects.
2. Introduce a small shared design-token and component layer; split the monolithic page into maintainable modules only when this can be done without disrupting the secure Pages deployment.
3. Add real dynamic Home data only through existing authenticated AEGIS APIs; avoid invented status metrics.
4. Implement the companion profile selector and presence state using the existing versioned companion contracts.
5. Benchmark a minimal 2D portrait/renderer, then Three.js versus Babylon.js on modest mobile hardware. Keep WebGL/WebGPU optional and Tier 0 fully functional.
6. Review the source and licensing of the owner's 3D Website Builder before reusing any of its avatar assets or implementation.
7. Only after secure Preview authentication is provisioned, verify the real signed-in workflow end to end. Do not ask the user to paste secrets into chat.


## Latest mobile regression and correction

The first client-side visual simulation found that a late desktop grid declaration overrode the earlier mobile breakpoint, causing the signed-in shell to retain its 218px sidebar column at 390px. This was corrected in `index.html` by explicitly collapsing the app shell to one column at the 820px breakpoint and placing the toolbar and content sections in the full-width column.

A regression test now asserts the one-column shell and full-width toolbar/sections at tablet/mobile widths. GitHub Actions run 43955818365 completed successfully after the correction, including Node.js/Miniflare tests and all isolated D1/Forge safeguards. The corrected Pages preview is https://a48f74a1.aegis-6yk.pages.dev (commit `1d9741e4d4d0930d133aff6fc14c58ea36f87031`).

The correction has passed CI. A final visual recheck of the corrected signed-in layout remains pending; the signed-in screen is only being previewed client-side because Preview authentication is not configured. This is not authenticated functional verification.


## Additional upstream candidates reviewed — 2026-11-16

This review adds the user's latest candidate list. Decisions below distinguish integration from code reuse. AEGIS remains the owner of identity, orchestration, memory, policy, approvals and execution; upstream tools must not become competing authorities.

### Security, skills and evaluation

| Candidate | Verified project / licence | Useful capability | AEGIS decision and safeguards |
|---|---|---|---|
| NVIDIA SkillSpector | [NVIDIA/skillspector](https://github.com/NVIDIA/skillspector), Apache-2.0 | Static and optional LLM analysis of skill bundles; prompt injection, exfiltration, privilege escalation, MCP least-privilege and supply-chain checks; CLI and MCP interface. | **Adopt as a high-priority scanner candidate.** Place before skill/MCP installation and upgrades. Run static-only by default for private material; optional LLM scan must disclose provider egress. It is not a sandbox and does not execute or contain installed skills. Bound inputs and fail closed on incomplete analysis. |
| Snyk Agent Scan (interpreting user's “Sunk agent scan”) | [snyk/agent-scan](https://github.com/snyk/agent-scan), Apache-2.0 | Discovers agents, MCP servers and skills across supported local agent configurations and assesses risk. | **Evaluate as a second-opinion discovery scanner, not an AEGIS dependency.** Its documentation says analysis sends component information, tool definitions and skill content to its analysis service (with secrets redacted); require explicit opt-in and a clear data-flow notice. Its CLI output schema is explicitly experimental, so do not bind Sentinel policy to unstable output fields. MCP discovery can start configured processes or make network calls; sandbox and review first. |
| Promptfoo | [promptfoo/promptfoo](https://github.com/promptfoo/promptfoo), MIT | LLM evaluation, prompt/model comparison, red-team testing and vulnerability scanning. | **Adopt for offline/local CI evaluation where possible.** Create AEGIS-specific adversarial suites for prompt injection, memory poisoning, tool misuse, policy bypass, privacy leakage and refusal/overblocking. External providers are optional; no paid API in the required test path. |
| Skills Janitor | [khendzel/skills-janitor](https://github.com/khendzel/skills-janitor), MIT | Inventory, duplicate detection, stale/broken skill discovery, token-cost hygiene and security-oriented skill review. | **Borrow the hygiene workflow, do not depend on the plugin.** The project states it entered maintenance mode in September 2026 and that core context-cost functions are now native to Claude Code. Any prune/delete action in AEGIS must be previewed, reversible and explicitly approved. |
| SkillSpector + Agent Scan combination | Above | Complementary skill-package analysis and broader installed-component discovery. | **Create a provider-neutral AEGIS Skill & Connector Intake Gate.** Normalize findings into AEGIS-owned evidence records; Sentinel independently decides quarantine, allow, warn or reject. Scanner scores never grant permissions. |

### Efficiency, model routing and local models

| Candidate | Verified project / licence | Useful capability | AEGIS decision and safeguards |
|---|---|---|---|
| Squeez | [KRLabsOrg/squeez](https://github.com/KRLabsOrg/squeez), Apache-2.0 | Task-aware reduction of verbose tool output, with generative Qwen 3.5 2B and extractive ModernBERT approaches. | **Prototype behind a bounded context-compression interface.** Preserve original output, provenance, error lines, exit codes and security-relevant evidence. Compression is lossy: never let it replace raw evidence for approvals, audit, security decisions or debugging. Benchmark quality and latency against deterministic truncation first. |
| Claude Code Router | [musistudio/claude-code-router](https://github.com/musistudio/claude-code-router), MIT | Local model gateway/control plane with provider routing, failover, retries and observability for multiple coding agents. | **Use as an interoperability reference / optional adapter only.** AEGIS's own model/provider registry and routing policy remain authoritative; OmniRoute stays optional. Do not make CCR mandatory or allow its provider routing to bypass Sentinel, privacy rules, cost limits or model-data disclosures. |
| Ornith-1.5-35B-A3B-GGUF | [ornith-ai/Ornith-1.5-35B-A3B-GGUF](https://huggingface.co/ornith-ai/Ornith-1.5-35B-A3B-GGUF), Hugging Face model repository; model card reports MIT | Local GGUF quantization of a 35B-parameter mixture-of-experts model with roughly 3B active parameters per token; llama.cpp-compatible. | **Add to the experimental local-model benchmark list, not the default model.** Active-parameter count does not equal memory footprint: the full expert weights must remain resident. Quantized files are still large (roughly tens of GB); unsuitable for the current Chromebook/iPhone/iPad baseline. Test only on suitably provisioned user-owned hardware, with model provenance, licence and performance verified. The GGUF variant described in the model card is text-only; do not assume vision support. |

### Personal data, device continuity and home automation

| Candidate | Verified project / licence | Useful capability | AEGIS decision and safeguards |
|---|---|---|---|
| Syncthing | [syncthing/syncthing](https://github.com/syncthing/syncthing), MPL-2.0 | Peer-to-peer continuous file synchronisation, signed releases and cross-platform operation. | **Strong optional sync transport candidate.** AEGIS must retain its own encrypted data format, device identity, conflict-resolution rules, revocation and authenticated pairing. Syncthing transport alone is not the AEGIS trust or encryption-at-rest layer. Never sync live secrets or authority tokens as ordinary files. |
| Anytype | [anyproto/anytype-ts](https://github.com/anyproto/anytype-ts), Any Source Available License 1.0 (not an OSI open-source licence) | Local-first, peer-to-peer, end-to-end-encrypted knowledge workspace; composable objects and gRPC API. | **Consider optional interoperability only.** Do not base AEGIS core on it or transplant its code: its source-available licence restricts commercial use to defined allowed networks. Keep AEGIS Memory/Knowledge Forge independent and support export/import or a separately reviewed adapter. |
| Home Assistant Core | [home-assistant/core](https://github.com/home-assistant/core), Apache-2.0 | Broad integration ecosystem and local automation/control of home devices. | **High-value optional home/IoT adapter.** Keep disconnected by default. Every physical-world action needs explicit device-level scopes, user-visible confirmation for consequential actions, rate limits, audit and emergency stop. AEGIS must not inherit Home Assistant credentials or treat device state as instructions. |
| AdGuard Home | [AdguardTeam/AdGuardHome](https://github.com/AdguardTeam/AdGuardHome), GPL-3.0 | Self-hosted network-wide DNS filtering and tracker blocking. | **Optional privacy/home-network service integration, not an AEGIS core dependency.** AEGIS can expose health/status and setup guidance only with user permission. DNS changes can disrupt connectivity; require explicit approval and rollback instructions. |

### Documents, sharing and developer learning

| Candidate | Verified project / licence | Useful capability | AEGIS decision and safeguards |
|---|---|---|---|
| Stirling-PDF | [Stirling-Tools/Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF), MIT for general repository content with separately licensed/restricted subdirectories | Self-hosted PDF editing, conversion, OCR, signing, redaction, REST APIs and workflow automation. | **Strong optional document-tool adapter.** Prefer a local/self-hosted endpoint; make document egress explicit. Review nested directory licences before reusing any code. Redaction and signing operations require preview and confirmation. |
| Bitwarden Send | Bitwarden feature in the [Bitwarden clients](https://github.com/bitwarden/clients) and [server](https://github.com/bitwarden/server) ecosystem, not a separate standalone Send repository. Server repository defaults to AGPL-3.0 except specifically marked Bitwarden-licensed code. | Encrypted sharing of text/files with expiry and access controls. | **Integrate existing Bitwarden Send only as an optional user-authorized service.** Do not build AEGIS credential storage on Bitwarden internals or copy proprietary directories. Never expose secrets in chat, logs, analytics or audit payloads; provide expiry/revocation visibility. |
| Keploy | [keploy/keploy](https://github.com/keploy/keploy), Apache-2.0 | Records and replays API/integration traffic to generate repeatable tests and mocks; supports databases and event streams. | **Evaluate for isolated integration testing.** Capture only synthetic or scrubbed test traffic. Never record production sessions, credentials, personal data or real provider payloads without explicit, bounded approval. |
| The Missing Semester | [missing-semester/missing-semester](https://github.com/missing-semester/missing-semester), course content CC BY-NC-SA 4.0 | Practical teaching material for command line, shell, Git, debugging, data wrangling and developer tooling. | **Use as a learning-path reference for AEGIS community onboarding.** Link to the course and create original exercises; do not copy course text into AEGIS documentation without following its non-commercial/share-alike terms. |

### Unresolved names / identity checks

- **“Token Optimizer”** is not a unique repository identity from the name alone. Squeez is a verified candidate for task-aware tool-output compression, but it may not be the separate project intended. Keep the other entry pending an exact URL or owner/repository name.
- **“Sunk agent scan”** was interpreted as **Snyk Agent Scan** because that is the matching agent/MCP/skills security scanner. Correct this entry if a different project was intended.
- **“Ornith-1.5-35B-A3B-GGUF”** is a Hugging Face model repository, not a GitHub source repository.
- **“Bitwarden Send”** is a product feature rather than its own repository.
- **“Squeez”** was resolved to KRLabsOrg/squeez.

### Priority order from this review

1. Build the AEGIS-owned Skill & Connector Intake Gate, with SkillSpector first and Snyk Agent Scan as opt-in second opinion.
2. Add Promptfoo adversarial/evaluation suites to CI and regression tests.
3. Prototype Squeez behind evidence-preserving context compression; benchmark before adoption.
4. Add optional Syncthing-based transport only after AEGIS device identity, encryption, pairing, conflict and revocation contracts are ready.
5. Define optional adapters for Home Assistant, Stirling-PDF and Bitwarden Send with Sentinel-scoped permissions.
6. Benchmark local models such as Ornith only on appropriate hardware; keep small/local/offline alternatives and cloud providers replaceable.
7. Use Missing Semester as a community learning reference; treat Anytype and Claude Code Router as interoperability references, not architectural foundations.

No upstream repository has been copied into AEGIS by this research update. All integrations remain proposals until interface, security, resource, maintenance and licence gates are passed.


## Further upstream candidates reviewed — 2026-11-16 (second batch)

The following candidates were resolved to their likely canonical repositories and reviewed at README and licence level. “ag-hi” was interpreted as AG-UI because that protocol was previously supplied and discussed; if the user intended a different repository, keep that name unresolved rather than silently substituting another project.

### Architecture visualisation and agent interface

| Candidate | Verified repository / licence | Capability | AEGIS decision |
|---|---|---|---|
| draw.io Skills | [Agents365-ai/drawio-skill](https://github.com/Agents365-ai/drawio-skill), MIT | Agent skill generating editable draw.io architecture diagrams from natural language, code, Terraform/Kubernetes, SQL, OpenAPI, AsyncAPI and other sources; can incrementally update diagrams and produce multiple views. | **High-priority skill candidate.** Use to generate architecture, trust-boundary, data-flow, device-adapter and workflow diagrams from AEGIS-owned schemas. Must pass AEGIS Skill & Connector Intake Gate (SkillSpector first); inspect every script, command and network permission. Generated diagrams are review artefacts, never executable authority. |
| “ag-hi” → AG-UI (assumed) | [ag-ui-protocol/ag-ui](https://github.com/ag-ui-protocol/ag-ui), MIT | Open event-based protocol for agent-to-application streaming, shared state, human-in-the-loop, tool events and subagent activity. README states AG-UI 1.0 has a stable frozen spec and generated TypeScript, Python and .NET SDKs. | **Already part of AEGIS architecture/research.** Preserve the existing bounded, owner-only lifecycle replay implementation. Use protocol events for future companion/workspace streaming, but do not treat client events as permissions or trusted execution results. Do not add a second competing event authority. |

### Model foundations, training and learning references

| Candidate | Verified repository / licence | Capability | AEGIS decision |
|---|---|---|---|
| micrograd | [karpathy/micrograd](https://github.com/karpathy/micrograd), MIT | Tiny scalar automatic-differentiation engine and neural-network library; makes computational graphs, gradients and backpropagation understandable. | **Learning/reference only.** Useful for AEGIS internal learning materials and for understanding model training foundations; not a production inference engine or a reason to build a neural framework into AEGIS. |
| Hugging Face LLM Course | [huggingface/llm-course](https://github.com/huggingface/llm-course), Apache-2.0 repository | Course material for building large language models. | **Community learning reference.** Link to the course and build original guided lessons; review notebooks, datasets and referenced model licences separately before redistributing any material. |
| Neural Networks: Zero to Hero | [karpathy/nn-zero-to-hero](https://github.com/karpathy/nn-zero-to-hero), MIT | Code-first lecture series building neural networks, language models and GPT-style models from basics, with notebooks and exercises. | **Strong learning-path reference.** Use as optional self-study material for contributors and an internal curriculum for understanding AEGIS model/learning components. |
| Awesome Hugging Face | [huggingface/awesome-huggingface](https://github.com/huggingface/awesome-huggingface), Apache-2.0 | Curated catalogue of Hugging Face projects, libraries, tutorials and NLP tooling. | **Reference index only.** GitHub reports this repository as archived, so do not treat it as a current package/security/maintenance authority. Check each listed upstream independently. |
| nanoGPT | [karpathy/nanoGPT](https://github.com/karpathy/nanoGPT), MIT | Minimal GPT training/fine-tuning implementation. | **Historical educational reference; do not adopt as current foundation.** Its README explicitly says it is very old and deprecated (November 2025). The author points users to nanochat as its newer experimental successor. |
| nanochat (successor worth noting) | [karpathy/nanochat](https://github.com/karpathy/nanochat), MIT | Minimal experimental end-to-end LLM training harness covering tokenization, pretraining, fine-tuning, evaluation and inference, designed around a single GPU node. | **Research/benchmark reference only.** Not a free-to-run default for AEGIS: training requires capable GPU hardware and the README's low-cost training example still requires paid GPU compute. Preserve AEGIS's model-agnostic runtime and use existing pretrained local models first. |

### Data, feedback and research intelligence

| Candidate | Verified repository / licence | Capability | AEGIS decision |
|---|---|---|---|
| Grist | [gristlabs/grist-core](https://github.com/gristlabs/grist-core), Apache-2.0 | Self-hostable relational spreadsheet/database hybrid, formulas, Python logic, and desktop/static variants. Some features are not present in community core and are separately offered by Grist Labs. | **High-value optional data workspace.** Explore integration through documented APIs or import/export for project registers, structured personal datasets and community operations. Keep AEGIS Memory/Forge as the authoritative intelligence and evidence store; don't make Grist mandatory or assume hosted paid features are free. |
| Formbricks | [formbricks/formbricks](https://github.com/formbricks/formbricks), AGPL-3.0 overall, with explicitly MIT-licensed packages and separately licensed enterprise directory | Self-hostable, privacy-oriented survey and feedback platform for in-app, website, link and email surveys, with analysis. | **High-value optional community-feedback adapter.** Useful for feature requests, satisfaction surveys and contributor feedback. Prefer a separately deployed service/API integration; assess AGPL obligations before modifying/embedding server code. Collect only voluntary, minimised data with clear consent and retention controls. |
| changedetection.io | [dgtlmoon/changedetection.io](https://github.com/dgtlmoon/changedetection.io), Apache-2.0 | Website/content change monitoring, notification integrations, conditional alerts and optional LLM-based summaries; README describes local Ollama and OpenAI-compatible endpoints. | **High-priority optional upstream watch service.** Monitor selected upstream releases, security advisories, documentation and breaking changes. Route notifications into an AEGIS review queue; never auto-install or auto-update third-party code from a detected change. Treat URL fetching as an SSRF/network-egress risk: restrict destinations, block private/link-local metadata ranges, isolate browser fetches and require user approval for new watches/notifications. |
| Vane (confirmed identity) | [psas-ch/Vane](https://github.com/psas-ch/Vane), MIT; formerly Perplexica | Self-hosted AI answering/search engine using SearXNG, local Ollama or optional cloud providers, with cited sources, domain-specific search, file uploads and local search history. | **High-value optional research adapter.** Useful for a self-hosted/private research experience. AEGIS must independently verify citations, track provenance, separate fetched content from instructions, and disclose any external provider/data egress. Do not replace AEGIS's research and source-evidence contracts. |
| Metabase | [metabase/metabase](https://github.com/metabase/metabase), AGPL outside top-level enterprise directory; commercial licence in enterprise directory | Business intelligence and analytics: SQL editor, no-code questions, dashboards, alerts, data modelling, embedding and AI/data-agent features. | **Optional analytics workspace, not AEGIS core.** Could provide operational dashboards over explicitly approved, minimised AEGIS metrics or community analytics. Never expose private conversation, memory or identity data by default. Prefer a separately deployed integration; review AGPL and enterprise boundaries carefully. |

### Revised priorities

1. **Skill and architecture visibility:** validate drawio-skill through the intake gate, then generate maintained architecture and security diagrams from AEGIS contracts.
2. **Upstream intelligence:** prototype changedetection.io for release/security/documentation monitoring, with strict SSRF protections and human-approved update proposals.
3. **Research quality:** assess Vane as a replaceable self-hosted search provider while preserving AEGIS source provenance and verification.
4. **Community feedback:** evaluate Formbricks for voluntary, privacy-preserving feedback; keep it optional and respect AGPL boundaries.
5. **Structured user data and operational analytics:** evaluate Grist for user-owned data workspaces and Metabase for optional aggregate dashboards, not as AEGIS's memory or policy authority.
6. **Contributor education:** curate micrograd, LLM Course and Zero to Hero as external learning paths. Keep nanoGPT labelled deprecated and nanochat experimental/hardware-intensive.
7. **Protocol continuity:** retain AG-UI 1.0 as the existing agent/UI streaming contract; no parallel protocol stack.

No code, assets, packages or model weights from these projects have been imported. Repository-level licence labels do not automatically cover bundled assets, datasets, notebooks, dependencies, model weights or enterprise directories; those need separate review before redistribution or integration.


## Further learning, agent engineering and prompt-research candidates (16 Nov 2026)

The following user-supplied resources were checked against their repository metadata and README. They are classified as learning material or research references unless an explicit AEGIS integration is described. No source code, prompt corpus, datasets or model weights are imported by this review.

| Candidate | Verified repository / licence | What it offers | AEGIS decision |
|---|---|---|---|
| Awesome Artificial Intelligence | [owainlewis/awesome-artificial-intelligence](https://github.com/owainlewis/awesome-artificial-intelligence), MIT | Actively maintained, opinionated index of AI books, courses, papers and practical resources, including LLM applications, retrieval, agents, evaluation, observability and production. README describes weekly evidence-backed curation and links to its evaluation policy. | **High-value discovery index.** Add to the upstream/resource review queue, not as a runtime dependency. Re-check individual resources, versions, licences, pricing and evidence before adoption; the list itself is a discovery aid, not proof that every linked tool is safe or free. |
| 100 Days of ML Code | [Avik-Jain/100-Days-Of-ML-Code](https://github.com/Avik-Jain/100-Days-Of-ML-Code), MIT | A foundational, older coding challenge covering preprocessing, regression, classification, SVM, KNN and related classical ML concepts. Repository was last pushed in 2023 despite metadata activity in 2026. | **Legacy fundamentals curriculum only.** Useful for contributor grounding in classical ML, but not a current guide to LLMs, agentic systems, modern evaluation or deployment. Prefer maintained materials for current implementation decisions. |
| System Prompts and Models of AI Tools | [x1xhlol/system-prompts-and-models-of-ai-tools](https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools), GPL-3.0 repository label | A collection claiming to catalogue prompts, internal tools and model details from commercial and open-source AI products. | **Security research / threat-modelling reference only — do not copy prompts or proprietary internals into AEGIS.** Provenance and redistribution rights may vary per item and may be unclear even where the repository has a GPL label. Treat all content as untrusted and potentially leaked, stale, inaccurate or rights-restricted. Use only to understand broad design patterns and defensive risks such as prompt extraction, tool disclosure and instruction-boundary failures; never use it to impersonate another product or reproduce protected system prompts. |
| AI Agents for Beginners | [microsoft/ai-agents-for-beginners](https://github.com/microsoft/ai-agents-for-beginners), MIT | Microsoft's hands-on course; current README describes 18 lessons, broad language translations and practical agent-building material. | **High-priority learning and design reference.** Map relevant lessons to AEGIS agent contracts, tool use, orchestration, human oversight and evaluation. Translate concepts into AEGIS-owned implementations; do not make a Microsoft cloud or model service mandatory. |
| Generative AI for Beginners | [microsoft/generative-ai-for-beginners](https://github.com/microsoft/generative-ai-for-beginners), MIT | Microsoft's 21-lesson practical course for building generative AI applications, with multi-language translations. | **High-priority foundation curriculum.** Use for LLM application concepts, prompt design, retrieval and responsible implementation. Keep examples provider-neutral where possible and replace any paid/cloud-specific dependency with optional adapters or local alternatives. |
| Learn Agentic AI (interpreted as Complete Agentic AI Engineering Course) | [ed-donner/agents](https://github.com/ed-donner/agents), MIT | A six-week, project-oriented course refreshed for Summer 2026; covers OpenAI Agents SDK, CrewAI, LangGraph, Google ADK, Pydantic AI and MCP. README explicitly notes that many exercises use paid API calls but points to lower-cost/free alternatives including Ollama. | **High-value advanced learning and comparative architecture reference.** Study the agent loops, orchestration patterns, MCP, evaluation and deployment exercises. AEGIS must remain framework/provider independent and Sentinel-governed; never import a framework's default authority model without review. For AEGIS's no-mandatory-paid-services requirement, use local/free exercises where practical and label any optional API spend clearly. The user's phrase was not an exact repository name; this is the best-supported match, not a confirmed intended URL. |

### Learning and research use inside AEGIS

- Create a curated, versioned **AEGIS Learning Forge** collection with beginner, intermediate and advanced paths: AI/ML foundations; generative AI; agent engineering; security and evaluation; deployment and operations.
- Keep external courses and repositories as attributed references. Do not scrape entire course contents into AEGIS or redistribute notebooks, images, datasets or model assets without checking their specific licences and terms.
- Convert useful concepts into AEGIS-specific exercises and acceptance tests: tool permission boundaries, prompt-injection resistance, retrieval provenance, memory poisoning, human approval, model/provider portability, cost ceilings, local/offline operation and graceful failure.
- Distinguish educational sample code from production-ready architecture. Every candidate pattern must pass AEGIS's security, privacy, accessibility, licensing and low-cost gates before implementation.
- Treat leaked or extracted system prompts as hostile research material, not trusted specifications. AEGIS's own system prompts, secrets, policy rules and private implementation details must never be exposed to a connected tool or user-facing diagnostic.

### Updated learning priorities

1. **Agentic engineering:** Microsoft AI Agents for Beginners, then the refreshed ed-donner/agents course for deeper multi-framework comparison.
2. **Generative AI foundations:** Microsoft Generative AI for Beginners, paired with the existing Hugging Face LLM Course and Full Stack Deep Learning references.
3. **ML foundations:** 100 Days of ML Code as optional historical practice; use maintained resources for current ML engineering.
4. **Continuous discovery:** Awesome Artificial Intelligence as a curated discovery index with independent source, licence, freshness and cost checks.
5. **Defensive prompt research:** system-prompts-and-models-of-ai-tools only for high-level threat modelling; no copying, execution or trust in leaked content.

No code, assets, prompts, notebooks, datasets, packages or model weights have been imported. These are research and learning decisions only; no AEGIS runtime capability is claimed as implemented by this entry.
