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
