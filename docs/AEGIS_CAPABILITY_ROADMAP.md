# AEGIS capability roadmap and upstream adoption plan

**Status:** Proposed implementation roadmap, recorded 16 November 2026  
**Branch:** `feature/composio-audit-lineage-verified`  
**Purpose:** Convert the upstream research register into a controlled, buildable sequence. This is a product/engineering plan, not a claim that every capability is implemented.

## 1. Non-negotiable product rules

1. **One AEGIS, many surfaces.** One identity, intelligence core, policy authority, memory model and task history across web, desktop, mobile, tablet, XR and supported TV/console experiences.
2. **Free-first and open-source-first.** No mandatory subscription, paid API, paid model, proprietary cloud, or paid hosting dependency. Optional external providers must be clearly disclosed, replaceable and cost-controlled. A local mode must remain available where the device can support it.
3. **Sentinel is the authority.** No agent, model, protocol, skill, plugin, workspace, CRDT, external identity service or approval UI can grant itself permission. Every action is re-authorised by Sentinel against an exact principal, resource, capability, scope, expiry, risk and approval requirement.
4. **Human control is real.** Users can inspect, pause, cancel, revoke, export and delete within documented retention and safety constraints. High-impact actions require explicit confirmation. No hidden background action.
5. **Privacy by default.** Minimise collection, avoid persistent device fingerprinting, encrypt secrets, keep credentials out of agent prompts, and make network/provider egress visible.
6. **Modular and replaceable.** Use versioned contracts and adapters. No framework becomes an irremovable dependency without evidence and a migration plan.
7. **Accessible graceful degradation.** Text and essential functions work without 3D, voice, WebGPU, XR or a powerful device. Respect reduced motion, assistive technology, battery, heat and bandwidth.
8. **Provenance and honesty.** Distinguish implemented, prototype, planned, unavailable and externally provided capabilities. Record source, licence, version, cost and limitations.

## 2. Architecture: what belongs to AEGIS

| Layer | AEGIS-owned responsibility | External projects may contribute |
|---|---|---|
| Identity and experience | AEGIS identity, user profiles, companion identities, preferences, accessible UI and device continuity | UI patterns, renderers, avatar tooling |
| Intelligence orchestration | Task lifecycle, planning contracts, model selection policy, context assembly, memory retrieval and delegation | Model SDKs, agent frameworks behind adapters |
| Sentinel security plane | Authentication, grants, approvals, risk policy, rate limits, revocation, audit and policy decisions | Schema libraries and isolated policy-evaluation helpers only |
| Memory and knowledge | Owner-scoped evidence, provenance, confidence, time validity, supersession, retraction, retention and export | RAG/indexing algorithms and storage adapters |
| Skills and tools | Skill catalogue, manifests, review, signing/provenance, capability requests and execution policy | MCP servers, parsers, sandbox runtimes |
| Execution plane | Isolated workers, queues, resource limits, result validation and receipts | Container/WASM/remote execution backends |
| Interoperability | Stable AEGIS contracts and protocol gateways | MCP, AG-UI, A2A, ACP and provider SDKs |
| Device adaptation | Capability profile, quality tiers, platform adapters and privacy contract | Browser/native feature-detection APIs and render engines |
| Operations and updates | Versioned releases, signed update metadata, migrations, rollback, observability and incident response | CI, telemetry and deployment tooling |

**Boundary rule:** External agent frameworks execute behind the AEGIS execution boundary. They receive a narrowly scoped task envelope, not the Vault, raw provider credentials, unrestricted filesystem, arbitrary network, or direct policy/database authority.

## 3. Build / adapt / connect / reject

### Build ourselves — the AEGIS differentiators

- Sentinel policy and approval authority, exact-resource grants and revocation.
- Canonical task/run state, idempotency, cancellation, event lineage and append-only audit.
- Owner-scoped memory and Knowledge Forge with evidence/provenance, confidence, temporal validity, correction and retraction.
- Skill/tool catalogue, capability manifests, review state, version pinning and compatibility checks.
- Device capability broker (AIDE working name), tier selection and privacy contract.
- Companion identity/profile format and companion experience contract.
- Update manager: signed manifests, compatibility checks, staged rollout, backup/migration, rollback and security advisories.
- User control centre: connected devices, agents, permissions, memory, data export, privacy, costs and activity history.

### Adapt selectively — never wholesale replace

- **OpenBot:** workspace UX, agent-owned browser/computer concept, AG-UI integration, approvals and audit presentation. Rebuild the required UX with AEGIS authority.
- **AnythingLLM:** document ingestion, workspace chat, citations, local model and agent-flow patterns. Keep AEGIS memory and task contracts canonical.
- **OpenClaw:** gateway/channel separation, provider interchangeability and user-owned state patterns. Do not inherit ambient host access.
- **CowAgent / Hermes Agent:** capability catalogue, skills, memory lifecycle, scheduling, subagent and learning-loop patterns. Do not import autonomous self-modification or unrestricted shell.
- **OpenHands / Pi Herdsman:** isolated coding-agent backends, branch/workspace ownership, bounded parallel work and supervision. Development tools are not automatically user-facing production agents.
- **Babylon.js / Three.js:** benchmark both for companion rendering; do not commit to a renderer until real-device tests.
- **Pipecat / LiveKit:** benchmark voice pipelines; select one per concrete use case after latency, privacy, hosting and cost tests.
- **Yjs / Automerge:** benchmark only for collaborative/offline user documents; do not use CRDTs for permission, financial, task-authority or audit state.
- **Extism / QuickJS WASM:** benchmark for untrusted extension execution behind a narrow host capability bridge.

### Connect through stable protocols

- **MCP:** external tools/resources; every call passes Sentinel and typed AEGIS tool contracts.
- **AG-UI 1.0:** frontend streaming and interaction events; never expose secrets, grants or private policy context in events.
- **A2A:** optional external agent discovery/delegation; external task becomes an AEGIS-owned task and is re-authorised.
- **ACP:** evaluate for coding-agent backend interoperability where useful.
- **Provider APIs / OpenAI-compatible endpoints:** model transport adapters only; AEGIS owns eligibility, routing policy, cost ceiling and audit.

### Reject as core dependencies

- Any project with unclear, non-commercial-only or incompatible licence terms unless a separate approved licence resolves the issue.
- Any platform that requires a paid provider, proprietary hosted control plane or paid API for essential AEGIS functionality.
- Unreviewed agents with ambient shell, filesystem, browser, account or network access.
- Multiple overlapping orchestration, memory, auth, vector, CRDT or voice frameworks without a proven use case.
- Repository code executed during discovery or source inspection.
- Device fingerprinting, covert hardware/app inventory, emotion inference presented as fact, or hidden recording.
- A single high-end 3D experience as the only interface.

## 4. Prioritised delivery roadmap

Each gate has explicit exit criteria. Work can overlap only when it does not bypass a dependency or weaken a security boundary.

### Gate 0 — Finish the current safe agent-run foundation

**Status:** In progress on draft PR #101; plan-only agent-run submission and bounded event replay are implemented in the current branch, but specialist execution is not enabled.

Deliver:
- Finish verification of owner-facing run submission, listing, detail, timeline and cancellation.
- Keep planning separate from approval and execution.
- Define a server-owned transition: planned → awaiting approval (when required) → approved → re-authorised by Sentinel → queued → running → completed/failed/cancelled.
- Bind approvals to immutable task intent, selected specialist, exact resources and expiry; changed intent invalidates approval.
- Ensure approval alone never queues work. A separate Sentinel decision must authorise the exact execution.
- Test replay, idempotency, cancellation races, expired/revoked grants and audit completeness.

Exit: regression suite passes; no execution path exists outside Sentinel; live runtime deployment remains a separate explicit decision.

### Gate 1 — AEGIS contracts and capability registry

Deliver:
- Versioned contracts for task, agent, skill, tool, memory evidence, device profile, companion profile, permission request and execution receipt.
- JSON Schema/TypeScript runtime validation at every trust boundary.
- Stable IDs, schema versions, compatibility rules and migration tests.
- A capability registry describing what an agent/skill can request, not what it is automatically allowed to do.
- A provenance record for every imported skill, tool adapter, model and upstream dependency.

Exit: invalid/unknown fields are rejected; incompatible versions fail safely; contracts are documented and tested.

### Gate 2 — Safe skills, tools and source inspection

Deliver:
- AEGIS-native skill lifecycle: discover → inspect → licence/provenance check → static analysis → human review → test in isolation → sign/pin → enable → monitor → revoke.
- Non-executing repository inspection using syntax-aware parsing (Tree-sitter candidate) and licence/dependency scanning in an isolated worker.
- A sandbox prototype comparing Extism and QuickJS WASM with deny-by-default host capabilities.
- No arbitrary shell or unrestricted network. Resource limits, output limits and kill/cancel are mandatory.
- MCP adapter with fixed tool allowlists, typed input/output schemas and Sentinel checks.

Exit: a malicious/untrusted sample cannot access secrets, host filesystem, arbitrary network or control-plane data; all calls have audit lineage.

### Gate 3 — Evidence-based memory and knowledge

Deliver:
- One canonical AEGIS memory/knowledge schema with owner and workspace scopes.
- Provenance, confidence, created/observed/valid times, source references, supersession, correction and retraction.
- Retrieval returns bounded, relevant evidence with citations/limitations; retrieved content is always untrusted data, never instructions.
- User controls to inspect, correct, export and delete supported memory records.
- Benchmark local vector/index options against the current D1/runtime constraints; do not add a second canonical store.
- Offline queue and reconciliation design for devices that temporarily disconnect.

Exit: cross-owner leakage tests pass; stale/retracted facts are handled; prompt-injection tests confirm retrieved content cannot override policy.

### Gate 4 — Agent workforce and workspace

Deliver:
- User-visible specialist roles (research, coding, security review, creative, personal organisation) as configurable profiles, not independent authorities.
- Shared task board, ownership, dependencies, progress, handoffs, cost/resource budgets and cancellation.
- Separate workspaces and branches for coding/research tasks; read-only by default, write access only to explicitly scoped workspace.
- Parallel work only for independent tasks; merge/release requires review and tests.
- AG-UI frontend adapter and optional A2A/ACP external agent adapters.
- User can see which agent is doing what, which sources/tools it used and what needs approval.

Exit: parallel agents cannot overwrite each other's work or elevate permissions; all results are attributable and reviewable.

### Gate 5 — Model routing and local/offline intelligence

Deliver:
- Provider registry with capability metadata, model version, context limits, modality, region, data handling and known pricing.
- Deterministic routing based on task type, user choice, quality, latency, privacy and budget.
- Explicit per-task cost ceilings; unknown price is unknown, never zero.
- Local inference adapter (Ollama/llama.cpp/local server and browser WebGPU candidate where device support permits).
- Local/offline degraded mode: cached data, local model where available, queued actions and transparent limits.
- Model comparison and evaluation harness using fixed test sets; model confidence is evidence, not permission.

Exit: user can disable all paid providers; core flows explain what still works locally/offline; routing tests prove budgets and privacy constraints are enforced.

### Gate 6 — Voice and multimodal companion interaction

Deliver:
- Speech input, VAD/turn detection, interruption, mute, push-to-talk and cancellation.
- Browser/native speech fallback before requiring an external provider.
- One isolated voice pipeline selected from benchmarked candidates; audio egress and retention are disclosed.
- Companion speech state is driven by the actual conversation/audio pipeline; voice and avatar remain independently usable.
- User-selected voice and consent-controlled voice profiles; no voice cloning without explicit rights/consent review.

Exit: voice can be interrupted instantly; microphone state is obvious; no audio is retained or transmitted without disclosed consent and configuration.

### Gate 7 — Adaptive device shell and AIDE

Deliver:
- Privacy-preserving, versioned capability profile based on feature detection and user-approved native capabilities.
- No stable device fingerprint, serial numbers, installed-app inventory, file scans or covert hardware inspection.
- Tier 0 accessible text baseline; Tier 1 voice/2D; Tier 2 standard 3D; Tier 3 advanced 3D; Tier 4 XR.
- Responsive PWA first, then native platform adapters based on actual demand and platform rules.
- Quality adapts to performance, battery, thermal state where legitimately available, bandwidth, accessibility and user choice.
- Explicit supported/degraded/unsupported status with understandable reasons.

Exit: core workflows work on modest phones, tablets and Chromebooks without WebGPU or 3D; adaptation is tested and can be overridden.

### Gate 8 — Lifelike 3D companion

Deliver:
- Portable companion identity/profile schema, rig and animation contract; official AEGIS persona plus fully user-created companion identities.
- Benchmark Babylon.js and Three.js on target devices; glTF/GLB portable asset baseline.
- WebGL2 or other tested baseline renderer where supported; WebGPU is optional acceleration, never a hard dependency.
- Facial expressions, visemes/lip-sync, gaze/gesture state, animation blending and interruption handling.
- LOD, compressed textures, lazy loading, adaptive frame rate and memory budgets.
- Optional abstract/non-human/no-avatar modes; user control over appearance, voice, movement and animation intensity.

Exit: stable, responsive experience on representative low-, mid- and high-tier devices; no essential action depends on the avatar; accessibility/reduced-motion checks pass.

### Gate 9 — Multi-device continuity and cooperative mode

Deliver:
- Secure device pairing, revocation and per-device capability display.
- Shared conversation/task handoff without duplicate agent authority or duplicate actions.
- Optional phone-as-mic/controller, tablet-as-workspace, desktop/TV-as-companion display.
- End-to-end encrypted device messaging where supported; short-lived session keys and replay protection.
- Offline reconciliation for user documents; authoritative task/security state remains on the AEGIS control plane.
- Optional self-hosted remote rendering/compute, never mandatory paid cloud.

Exit: disconnect/reconnect and device-loss tests pass; pairing is explicit and revocable; no raw camera/mic feed starts without user action.

### Gate 10 — Update, security and community ecosystem

Deliver:
- Signed release/update manifests and version compatibility.
- Separate app, model, skill, avatar asset, adapter and security-policy versions.
- Staged updates, backups, migration checks, rollback and security advisories.
- SBOM, licence notices, dependency scanning, secret scanning, reproducible build work where feasible.
- Public contribution process, issue templates, threat model, architecture decision records and security disclosure route.
- Self-hosting documentation and a free community edition with no essential paywall.

Exit: failed updates can roll back; migrations are tested; third-party assets and code are traceable; contributors cannot silently introduce privileged tools.

## 5. First implementation order after PR #101

1. Close the Gate 0 gaps and verify the current agent-run workflow. Do not add specialist execution until approval-to-Sentinel authorisation is independently tested.
2. Add the versioned capability/agent/skill/task contracts and contract tests.
3. Implement the skill/tool manifest and review lifecycle.
4. Prototype the sandbox and safe source-inspection worker.
5. Complete memory evidence/retraction contracts and cross-owner tests.
6. Add workforce UI and specialist profiles over the existing run API.
7. Build device capability profile and Tier 0/1 responsive shell.
8. Benchmark local model and voice options.
9. Benchmark 3D renderers/avatar rigs on modest real devices.
10. Expand to multi-device pairing and native platform adapters only after the web baseline is stable.

## 6. Upstream selection scorecard

Score each candidate from 0–5; weight the result. A high score does not bypass security or licence gates.

| Criterion | Weight | What earns a high score |
|---|---:|---|
| Licence and provenance clarity | 20% | Clear compatible licence, pinned commit, notices and dependency provenance |
| Security and isolation | 20% | Least privilege, clear trust boundaries, active security process, testable sandbox |
| Fit with AEGIS contracts | 15% | Adapters cleanly; no replacement of Sentinel, Vault, task or memory authority |
| Maintenance and community health | 10% | Recent meaningful releases, responsive maintainers, documented support |
| Platform and accessibility reach | 10% | Works across target devices and degrades gracefully |
| Resource footprint | 10% | Can run on modest hardware; no unnecessary services |
| Cost and self-hostability | 10% | No required paid control plane/API; transparent optional costs |
| Replaceability | 5% | Can be removed or swapped without data/architecture lock-in |

**Hard rejection regardless of score:** incompatible/unclear licence for copied code; known critical unmitigated security issue; required paid dependency for essential operation; hidden data egress; ambient privilege; inability to revoke or audit actions.

## 7. Delivery tracking and honest progress reporting

Track progress by gate and deliverable, not a made-up single percentage for the whole vision. For each update record:
- Gate status: Not started / In progress / Verified / Blocked.
- Exact commit/PR and files changed.
- Tests run and exact result; distinguish source tests, isolated integration tests and live deployment tests.
- Known limitations, risks and next acceptance criterion.
- Whether the work is documentation, prototype, implementation or production-ready.

Do not add percentages until a gate has a defined set of measurable acceptance checks. If percentages are later used, calculate them from passed checks within that gate and preserve the denominator between updates. Never report a documentation update as implementation progress.

## 8. Current truth as of this roadmap

- The canonical active work remains draft PR #101 on `feature/composio-audit-lineage-verified`.
- The earlier code commit `027fc8017250e893d3d4b5701e9f294c68647184` passed GitHub Actions run `43879054243`.
- The documentation/README branch head `f01651f90f9958ae47910fc386a0313238bd0b47` was subsequently verified by GitHub Actions run `43939797261` (completed/success). All 15 workflow steps passed, including Node.js tests, Cloudflare runtime integration tests in Miniflare, isolated capability/runtime/Forge D1 migrations, rate-limit and append-only audit checks, agent-run cancellation checks, and Forge licence/Knowledge Library safeguards.
- Run `43939797261` verifies the source and isolated local test environment at that commit; it does not establish that the production Cloudflare runtime Worker/Queue is deployed or live-integrated.
- The latest research-register commit at the time this roadmap was authored is `c7d49d4f0c318dd646cbce0ee89b418b2c135212`; it is documentation, not runtime implementation.
- Agent-run submission is plan-only. Specialist agent execution is not enabled.
- Cloudflare Pages preview does not mean the separate runtime Worker/Queue is deployed or live-integrated.
- No live Composio OAuth/provider call or paid provider service is configured by this work.
- No code from the newly reviewed OpenBot, AnythingLLM or Pi Herdsman repositories has been imported.
- 3D renderer and voice pipeline choices remain provisional pending device benchmarks.
- PR #101 remains draft, open and unmerged; production deployment is not authorised by this roadmap.

## 9. Upstream register

See `docs/AEGIS_UPSTREAM_RESEARCH_2026-11-16.md` for repository identities, licence evidence, inspection limits and per-project reuse decisions. See `docs/AEGIS_UNIVERSAL_DEVICE_AND_3D_EXPERIENCE.md` for the detailed companion/device architecture and platform research.


## 10. Adaptive System Guardian — proposed capability

**Status:** Architecture accepted for planning; not implemented. This does not change the current delivery-gate completion status.

The Adaptive System Guardian is a core AEGIS capability for permissioned understanding of the host device, evidence-led improvement recommendations, system posture awareness and resource-aware adaptation of AEGIS itself.

### Delivery slices

1. **Device profile contract:** versioned, minimal, revocable profile with source, timestamp, freshness, confidence and explicit supported/unavailable/not-permitted states.
2. **Read-only PWA discovery:** browser-visible capabilities only; no claims of host-wide application/process/driver inspection.
3. **AEGIS self-adaptation:** enforce user-defined CPU/memory/concurrency/cache/background budgets and adapt under battery, thermal, network and memory pressure.
4. **Native endpoint adapter:** one desktop platform at a time, selected only after REA, signed packaging, least privilege and isolated read-only testing.
5. **Recommendation engine:** rank evidence-linked findings by benefit, risk, confidence, resource/cost impact and reversibility.
6. **Sentinel-governed actions:** exact versioned allowlisted actions; initially AEGIS-owned reversible settings only, with preconditions, approval, audit, verification and rollback.
7. **Cross-platform expansion:** ChromeOS, iOS/iPadOS, Android, Windows, macOS, Linux and USB support only to the extent each platform exposes tested APIs.

### Non-negotiable boundaries

- No hidden monitoring, content inspection, keylogging, screenshots, microphone/camera activation or packet payload capture.
- No unrestricted shell, root/administrator daemon or arbitrary model-generated scripts.
- No automatic uninstall, third-party cleanup, software/driver installation, system setting change, firewall/DNS/VPN change, firmware/boot/encryption change or deletion of user data.
- Sentinel remains the sole authority; observations and tool outputs never grant permission.
- No persistent hardware fingerprinting; use a random, revocable device identifier.
- Unknown or unsupported checks are not green; show blind spots and freshness.
- Passive monitoring is opt-in, visible, low-frequency, pausable and budget-aware.
- Documentation, research and prototypes do not count as implementation progress.

### Exit criteria

The first useful release must demonstrate read-only device profiling on a supported surface, AEGIS resource-budget adaptation, transparent permission/coverage states, privacy and retention controls, hostile-output handling, cancellation and regression tests. Automatic changes remain a later, separately gated capability.

### Implementation checkpoint

**Slice 1 — device profile contract:** implemented on the feature branch and verified by GitHub Actions run `44051975331` (run 2308, completed/success) and subsequent run `44061929671` (run 2312, completed/success). The pure schema validator and profile factory enforce explicit observation provenance, status/confidence semantics, random revocable device IDs, strict field minimisation and storage-capacity consistency, including the zero-capacity edge case. No host discovery adapter, passive monitoring or automatic remediation is implemented.

**Gate 0 — owner approval and runtime authorisation:** the plan-only agent-run foundation remains separate from execution. GitHub Actions run `44061929671` (run 2312, completed/success) verified the full Node.js/runtime test step and all isolated capability, runtime and Forge D1 checks. A consumed approval can now be recovered only through its exact owner/capability binding; Sentinel revalidates the persisted plan digest and active exact-resource grant before retrying the same idempotent runtime authorisation. A revoked grant blocks recovery. Regression tests cover transient runtime failure, one-time consumption and revoked-grant denial. This still does not enable specialist execution, queue dispatch or tool invocation.

**Latest verified implementation head at this checkpoint:** `96f313e398b45f2951863116ee7433e062f3eb76`. The PR remains draft, open and unmerged; no production deployment is authorised.


## 11. Open-source learning, self-hosting and security research batch

**Status:** Research intake recorded; no new capability is claimed as implemented.

See [docs/REA_BATCH_2026-11-17_OPEN_SOURCE_LEARNING_SECURITY.md](REA_BATCH_2026-11-17_OPEN_SOURCE_LEARNING_SECURITY.md).

Proposed native capability families:
- Resource Intelligence Catalogue: verified free-tier limits, licence, freshness, self-hosting and operational-cost evidence.
- Adaptive Learning & Mastery Engine: user-controlled learning graphs, prerequisites, practice and evidence-based mastery.
- Self-hosted Software Intelligence: provenance, compatibility, maintenance, security and exit-path evaluation.
- Governed Security Research Engine: exact authorised scope, evidence-backed findings, isolated workers and Sentinel approval.

Delivery is gated on typed contracts and tests first. Security-agent research must not introduce ambient shell, Docker socket access, arbitrary network egress, C2, persistence or autonomous remediation. ARTEX, Cairn and CyberStrikeAI remain identity/provenance holds until exact upstreams and licences are independently verified. No external code was imported or executed.


## 12. Guardian Intelligence contracts — implementation checkpoint

**Status:** Pure validation contracts implemented on the stacked draft PR #103; full CI passed on 17 November 2026. This does not complete the Resource Intelligence, Learning & Mastery or Security Research capability families.

Implemented in `functions/lib/guardian-intelligence.mjs`:
- Resource record validation: canonical HTTPS provenance, source revision, explicit licence review/evidence, pricing evidence and limits, hosting requirements and strict field allowlists.
- Learning graph validation: unique nodes, attributable HTTPS sources, existing prerequisites and cycle rejection.
- Security finding validation: exact target scope digest, enumerated risk/confidence/status/method, digest-only evidence references and dynamic-test approval/grant lineage bound to the same scope digest.

Test-first evidence:
- RED: workflow `44127001100` failed on the new contract test module because the implementation module did not yet exist; 721 existing tests passed and one was skipped.
- GREEN/full CI: workflow `44127291884` completed successfully on implementation/documentation head `56b40e1d1939d44d7a3948c63092e570c7e74280`. The Node.js suite and all isolated capability, runtime, Queue/Miniflare and Forge D1 checks passed.
- The full test count is recorded in the workflow log; no test failure is hidden or waived.

Boundaries:
- Validators are pure structural checks, not an authorisation service, licence opinion, security certification or source-safety verdict.
- No new database migration, endpoint, UI, package, scanner or active security test was added.
- Dynamic testing remains disabled. A future server route must load trusted Sentinel grant/approval state and must reject caller-supplied authorisation lineage.
- PR #103 is draft, stacked on PR #101, unmerged and not production-deployed.


## 13. Guardian Resource Catalogue — first persistence slice

**Status:** Implemented and full CI verified on stacked draft PR #103; not production deployed.

- Added pure Resource, Learning Graph and Security Finding validators in `functions/lib/guardian-intelligence.mjs`.
- Added owner-scoped Resource Catalogue create/list storage in `functions/lib/guardian-catalogue.mjs`.
- Added `guardian_resources` and append-only `guardian_resource_events` in Forge migration `0006_guardian_resources.sql`.
- Added authenticated, same-origin, bounded `GET/POST /api/guardian/resources`. IDs are server-generated; new records remain drafts; duplicate owner/source/revision submissions are idempotent.
- Added CI D1 smoke evidence for resource creation, exactly one created event and rejection of event update/delete.

**Test-first and verification:** RED run `44127986972` confirmed the missing catalogue module/API/migration. The initial implementation run exposed a test-fixture parameter-binding mismatch; the fake D1 fixtures were corrected. Full CI run `44128806884` passed on `eda95b240b19392a12e42c74d7546f805120cbd9`: 745 tests, 744 passed, zero failed, one skipped, plus isolated capability/runtime/Queue/Forge D1 checks and the new Guardian Resource audit smoke checks.

**Not implemented:** resource review/acceptance, resource UI, learning graph persistence/progress, security finding persistence, scanners or active security testing. Dynamic tests remain disabled and must be Sentinel-authorised and isolated before implementation.


## UI ecosystem and companion interface foundation

The 17 November 2026 UI research batch records shadcn/ui, Magic UI, Aceternity UI, HyperUI, Material UI, React, Vue, Tailwind CSS and Awesome React/Vue/Frontend/Tailwind as candidates to investigate. This is not a mandate to adopt every framework or dependency.

The architectural direction is an AEGIS-owned design system:
- framework-neutral tokens and semantic interaction contracts;
- native HTML/CSS/SVG/platform primitives wherever practical;
- optional React and Vue adapters rather than a framework lock-in;
- accessibility, keyboard/focus, contrast, responsive/touch and reduced-motion requirements as acceptance criteria;
- motion/effects as optional progressive enhancement with performance budgets;
- component provenance, exact source revision, licence, dependency and modification records;
- no paid templates, hosted registries, proprietary components or external APIs as mandatory foundations.

shadcn/ui's copy-source/registry model, Magic UI and Aceternity's motion patterns, HyperUI's lightweight Tailwind layouts, and Material UI's mature control/accessibility contracts are learning sources. Aceternity's free and paid material must remain explicitly separated. Awesome lists are discovery indexes, never licence or security endorsements. See [AEGIS UI ecosystem research](AEGIS_UI_ECOSYSTEM_RESEARCH_2026-11-17.md).


## Developer operations and integration ecosystem

The 17 November 2026 research batch records HTTPie, DevToys, Gitignore templates, Docker/Moby, Terraform, Awesome DevOps/DevOps Exercises, Postman Collection format, Appwrite, Strapi, Novu and an unresolved Toolset candidate. See [Developer Operations & Integration Ecosystem](AEGIS_DEVOPS_INTEGRATION_ECOSYSTEM_2026-11-17.md).

The AEGIS direction is to own the contracts and policy while keeping tools and providers replaceable:
- offline-first local developer utilities;
- an API Workbench with versioned collection import/export, runtime secret injection and script execution disabled by default;
- container and IaC plan inspection with pinned provenance, isolation, policy checks and explicit human approval;
- backend, CMS and notification adapters that do not become mandatory core dependencies;
- provider-neutral notification preferences, quiet hours, deduplication and delivery audit;
- curated project templates with provenance and secret-safe defaults.

No container execution, Terraform apply/destroy, imported collection script execution, or provider installation is enabled by this research batch. Toolset remains unresolved until the exact upstream URL is supplied.


## Workspace, knowledge and coding-agent ecosystem (17 November 2026)

The research intake covers ToolJet, Mattermost, Outline, Plausible, Continue, Roo Code, SWE-agent, Plandex, GPT Pilot, Tabby and Goose. See [Workspace, Knowledge & Coding-Agent Ecosystem Research](AEGIS_WORKSPACE_KNOWLEDGE_CODING_AGENTS_2026-11-17.md).

Architecture direction:
- AEGIS Workbench: typed visual internal-app contracts, versioned definitions, scoped data connectors and reviewable agent-generated drafts.
- Shared collaboration: channels, threads, task-linked discussion and incident rooms; canonical task/audit state remains in AEGIS.
- Knowledge Forge: Markdown-first, permission-aware knowledge with provenance, confidence, temporal validity, supersession and retraction.
- Privacy-preserving observability: opt-in aggregate metrics, separated from security audit and without covert fingerprinting or raw prompt capture.
- AEGIS Forge: specialised Architect, Researcher, Implementer, Debugger, Test Engineer, Reviewer and Orchestrator profiles over one shared agent contract.
- Portable recipes and MCP/ACP adapters remain subordinate to Sentinel and AEGIS-owned task, permission and audit contracts.

Important upstream status and licence findings:
- ToolJet AGPL-3.0; Mattermost Team Edition core MIT with separately licensed add-ons/Enterprise features.
- Outline 1.10.1 is BSL 1.1, not OSI open source; commercial Document Service use is excluded by its additional grant.
- Plausible Community Edition AGPL-3.0; its tracker is MIT.
- Continue's repository is read-only/no longer actively maintained; Roo Code repository was archived 15 May 2026.
- SWE-agent upstream recommends mini-SWE-agent for current development.
- Plandex Cloud was winding down from 3 October 2025; local operation requires a user-supplied model provider.
- GPT Pilot has a disclosed supply-chain credential-stealing incident (24 Aug 2025–11 Jun 2026) and is not maintained: hard exclusion from installation/execution/adoption.
- Goose's canonical repository moved to aaif-goose/goose under the Agentic AI Foundation; Apache-2.0.

No upstream source was imported or executed. No agent execution, external service, analytics tracker or workspace platform was enabled. Coding agents must use isolated scoped workspaces, deny-by-default egress, bounded resources, secret redaction, cancellation, test/review gates and fresh Sentinel authorisation. No agent may merge or deploy autonomously.


## AEGIS Forge — 80-idea audit additions (17 November 2026)

Four additional capability candidates have been accepted into the research register: MediaPipe Face Landmarker for ephemeral camera challenge signals; MediaPipe Hand Landmarker/Gesture Recognizer for opt-in accessibility and custom gestures; FastMCP for optional local Python MCP sidecars; and a native scam/phishing/document-clause risk guard. Full assessment: [AEGIS Forge 80-Idea Audit Additions](AEGIS_FORGE_80_IDEA_AUDIT_ADDITIONS_2026-11-17.md).

Delivery decisions and safety gates:
- Face landmarks/blendshapes are not a certified liveness detector. Blink/head-turn challenges are only low-assurance signals; passkeys/WebAuthn remain primary authentication. No face identity recognition, persistent biometric templates or frame storage.
- Hand landmarks and stock gestures do not amount to full sign-language translation. Begin with custom gestures; fingerspelling/sign-language work requires appropriate datasets and Deaf-community co-design. Camera gestures are never the only duress/emergency path.
- FastMCP is an optional sidecar framework, not the AEGIS orchestrator. Prefer supervised stdio; HTTP sidecars bind loopback unless explicitly authorised. Sentinel validates every tool call independently.
- URLhaus community API access is subject to Auth-Key/fair-use and commercial-use terms; some downstream rulesets identify data as CC0, but that does not make all API use unrestricted. OpenPhish community feed is non-commercial and is not an assumed free production dependency.
- Mozilla PSL (MPL-2.0) supports registrable-domain calculation, not phishing detection. Add IDN/confusable heuristics, explainable evidence and freshness metadata. Never fetch or open suspicious destinations.
- Contract review is read-only issue-spotting, not legal advice or automated signing/acceptance.
- Cloudflare KV/Workers have usage and CPU limits; edge deployment is optional, not an unlimited or mandatory dependency.

No camera feature, model, sidecar, threat feed or document upload integration has been installed or enabled by this research.


## AEGIS Forge — ecosystem intake (17 November 2026)

**Status:** Research intake only; no implementation or new dependency adoption is claimed. See [AEGIS Forge Ecosystem Intake](AEGIS_FORGE_ECOSYSTEM_INTAKE_2026-11-17.md) for exact identities, licence findings, safety holds and delivery order.

The batch covers faster-whisper, Repomix, FLUX, Qwen3-TTS, UniCloud, TrailBase, Certimate, OpenPanel, the Cloudflare Workers Docker registry proxy, n8n-MCP, BuildingAI and IDA Pro MCP, plus unresolved `vibe-coding-prompt-t` and generic SaaS boilerplate candidates. `AI-Goldfish-Monitor` was interpreted as `Usagi-org/ai-goofish-monitor` and is restricted to generic scheduling/notification patterns; no account-cookie import, scraping or proxy-rotation adoption.

Key decisions: benchmark faster-whisper against existing Whisper.cpp; consider Qwen3-TTS only as an optional consent-governed local TTS adapter; use Repomix only to fill a measured repository-context gap; FLUX licences are variant-specific (schnell Apache-2.0, dev non-commercial); TrailBase OSL-3.0 is a code-reuse hold; OpenPanel's GitHub AGPL label and separate website EULA require reconciliation; Certimate is a possible read-only certificate-posture pattern; n8n and IDA MCP remain tightly scoped optional adapters; registry proxying is rejected for the build supply chain.

No package, model, container, MCP server, account or external service was installed, run, connected or deployed. No secrets or user content were uploaded, and no production state changed.


## AEGIS Forge — agent, knowledge, model engineering and infrastructure intake (17 November 2026)

**Status:** Research only. See [Agent, Knowledge, Model Engineering Intake](AEGIS_FORGE_AGENT_KNOWLEDGE_MODEL_ENGINEERING_INTAKE_2026-11-17.md) for project identities, licence/lifecycle flags, boundaries and delivery sequence.

Candidates reviewed: Prime Agent, Palantir Foundry/AIP, Google Agent Skills, celld, Code-Graph-RAG, LiteLLM, system-design-101, sqlmap, Weaviate, Chroma, Agno, smolagents, SuperAGI, DSPy, Guidance, possible Promotion Agent matches, Braintrust, Unsloth, Axolotl, LLaMA-Factory, TRL, torchtune, BentoML, Ray Serve, NVIDIA Triton, LoRAX and Supabase.

Architecture decisions:
- AEGIS remains the control plane; agent frameworks cannot own canonical memory, decisions, approvals or audit.
- Code-Graph-RAG informs possible graph enrichment only; existing Tree-sitter/code intelligence remains canonical until a measured gap is proven.
- Chroma is a local retrieval benchmark; Weaviate is scale-out only. No competing knowledge stores without evidence.
- DSPy/Guidance/Braintrust-style evals inform a native, versioned Eval Forge with held-out regression tests and approval-gated promotion.
- LiteLLM is optional protocol compatibility, never a mandatory proxy or policy owner.
- Fine-tuning stacks (Unsloth, Axolotl, LLaMA-Factory, TRL, torchtune) are deferred until a consented dataset, defined objective and feasible compute plan exist.
- BentoML is a possible light serving adapter; Ray/Triton are large-scale options. TGI and LoRAX are archived upstreams and are not selected as new defaults.
- sqlmap remains outside runtime; any later security-test use requires explicit target authorisation, isolated bounded tests and legal review of GPL/commercial embedding terms.
- Supabase remains optional; no migration from current D1/SQLite Guardian persistence without a measured requirement.

No project code, model, scanner, container or external service was installed, run, connected or deployed. No model training, SQL injection scan, account connection or user-data upload occurred.


### Eval Forge — deterministic evaluation and promotion evidence

**Status:** First pure scoring contract implemented and verified on draft PR #103. This is implementation progress, not a production evaluation service.

- Added strict, versioned evaluation-suite contracts and bounded weighted cases.
- Added deterministic run scoring bound to candidate version and SHA-256 artifact digest, with per-case evidence digests, bounded duration, required-case gates and stable result ordering.
- Required cases must pass regardless of aggregate score; skipped cases contribute no score.
- No raw prompts, model responses, file contents or user data are stored in the scoring result.
- The scorer does not execute tests, verify evidence bytes, authenticate runners or prove candidate safety. A future runner must produce a trusted isolated execution receipt.
- Evaluation score cannot grant permissions or promote a candidate. Human review, fresh Sentinel authorisation, rollback target and append-only audit remain separate requirements.

See [AEGIS Eval Forge](AEGIS_EVAL_FORGE.md) for the contract and next delivery sequence.


### Eval Forge — immutable suite registry (17 November 2026)

**Status:** Implemented and full CI verified on stacked draft PR #103 (17 November 2026).

- Added Forge migration `0008_eval_suites.sql` for owner-scoped, immutable suite versions, canonical SHA-256 content digests and append-only registration events.
- Added `functions/lib/eval-forge-store.mjs` with strict validation, canonical JSON hashing, idempotent registration, conflict rejection and bounded owner-scoped listing.
- Added authenticated same-origin `GET/POST /api/eval/suites`; owner identity is server-derived and writes are bounded.
- Added store/API/migration tests and D1 smoke checks for uniqueness and immutable suite/event history.
- A semantic version is immutable once registered; changed suite content requires a new version.
- Evaluation-run persistence, runner authentication, candidate execution, evidence receipt verification and promotion review remain separate future slices. The API does not accept a caller-supplied verified flag or permit evaluation scores to grant capabilities.


### Eval Forge — immutable evidence-verified run history (17 November 2026)

**Status:** Implemented and full CI verified on draft PR #103; latest full verification 19 November 2026.

- Added Forge migration `0009_eval_runs.sql` with owner-scoped unique run IDs, a foreign key to an exact registered suite version, bounded score/status constraints and append-only run events.
- Added `functions/lib/eval-forge-runs.mjs`: verifies the registered suite digest, verifies candidate/evidence bytes through the existing verifier, then stores only the result and digests. Raw artifact/evidence bytes and prompts are not retained.
- Identical retries are idempotent; conflicting reuse of a run ID is rejected. Results and audit events cannot be updated or deleted.
- No public run-submission API is exposed until an authenticated isolated runner can supply a trusted execution receipt. Digest integrity alone does not prove runner identity or honest execution.
- Scores remain evidence for human review only; they never grant capabilities, bypass Sentinel or trigger promotion.


- Added authenticated read-only `GET /api/eval/runs` for owner-scoped bounded result inspection. No public run-creation route exists before trusted runner attestation.
- Database constraints bind the stored result JSON to run/suite/candidate/status/score columns and require the evidence-integrity marker; readers reject missing markers.


### Learning Forge — immutable learning-path registry (17 November 2026)

**Status:** Implemented and full CI verified on draft PR #103 (17 November 2026).

- Added `migrations/forge/0010_learning_paths.sql` for owner-scoped immutable graph versions, canonical SHA-256 digest and append-only registration events.
- Added `functions/lib/learning-forge.mjs` to validate learning graph prerequisites, HTTPS source attribution and licence status; canonicalise JSON; register idempotently; reject conflicting content under an existing version; and list owner-scoped paths.
- Added authenticated same-origin `GET/POST /api/learning/paths` with bounded request bodies and page size.
- Added store, API and migration tests plus D1 smoke checks for duplicate-version rejection and immutable audit history.
- This is the immutable learning-path catalogue used by progress, assessment, applied-task evidence and mastery diagnostics. It does not scrape, copy or redistribute course content.
- Learning content is linked and attributed; the registry does not scrape, copy or redistribute course content.


### Learning Forge — prerequisite-gated learner progress (17 November 2026)

**Status:** Implemented and full CI verified on draft PR #103; latest full verification 19 November 2026.

- Added `migrations/forge/0011_learning_progress.sql` for owner/path-version/node progress and append-only events; progress history cannot be deleted.
- Added `functions/lib/learning-progress.mjs` with exact path/node binding, optimistic concurrency and prerequisite-gated transitions.
- Added authenticated `GET/PATCH /api/learning/paths/:id/progress`; writes are same-origin and bounded.
- Progress labels are `in_progress` and `self_reported_complete`, not verified mastery. API responses explicitly set `masteryVerified: false`.
- Both the service and D1 triggers enforce prerequisites before downstream completion. CI smoke checks attempt a database-level bypass and verify it is rejected.
- Assessment attempts, spaced-review suggestions and a non-certifying mastery evidence candidate are now implemented. Independent reviewer identity and certification remain future work.


### Learning Forge — deterministic assessment contract (17 November 2026)

**Status:** Immutable assessment registry, learner-safe delivery, server-scored attempt history and deterministic scoring are implemented and CI-verified on PR #103.

- Added `functions/lib/learning-mastery.mjs` and `tests/learning-mastery.test.mjs`.
- Validates bounded assessment definitions bound to an exact immutable Learning Path version and node.
- Deterministic weighted scoring requires exactly one valid answer per question and enforces a declared pass threshold.
- The scorer explicitly returns `masteryVerified: false`. Learner-safe API projections omit answer keys and pass thresholds; server-scored attempts retain score/pass/provenance but not raw answers or answer hashes.
- No external model-as-judge or automatic skill inference.


### Learning Forge — digest-only applied-task evidence receipts (19 November 2026)

**Status:** Implemented and full CI verified on draft PR #103. This is evidence provenance, not mastery certification.

- `POST /api/learning/paths/:id/evidence?version=:version&nodeId=:node` accepts authenticated same-origin binary submissions up to 2 MiB.
- AEGIS computes SHA-256 server-side and binds each receipt to the owner and exact immutable path version/node. Browser-supplied digests and filenames are rejected.
- Only digest, byte length, client-declared media type and server timestamp are stored; media type is not content-verified and raw bytes are discarded.
- Owner withdrawal deletes the digest receipt while preserving content-free append-only submission/withdrawal events.
- D1 enforces 25 active receipts per node and 500 per owner. Mastery input is bounded to 75 server-scored attempts plus 25 applied-task receipts.
- Independently authenticated human review and a privacy-preserving artifact-inspection handoff are not implemented. Mastery remains non-certifying and no capability or credential is granted.
- Full verification on code head `56aa8e05220d345c3f7470dac0a2f0ac8aaf1ade`: 985 Node tests, 984 passed, 0 failed, 1 skipped; Cloudflare preview, runtime/Queue and all isolated D1/Forge/Learning/Companion checks passed.

## Web Intelligence & Media Production Forge — ecosystem intake (17 November 2026)

**Status:** Research and architecture intake only. See [Web Intelligence & Media Production Intake](AEGIS_FORGE_WEB_INTELLIGENCE_MEDIA_PRODUCTION_INTAKE_2026-11-17.md).

- Reviewed Crawlee, Scrapy (duplicate collapsed), AutoScraper, curl-impersonate, yt-dlp, Video Use, FireRed-OpenStoryline, AutoClip, Herk Edit Kit, AutoSubs, StoryToolkitAI, FunClip, NarratoAI, BackgroundRemover and LatentSync.
- Web direction: AEGIS-owned permission-aware source registry, bounded crawl scheduler, extraction profiles, SSRF-safe fetch policy, content hashes, field-level provenance, freshness/drift tracking and reproducible exports. Crawlee/Scrapy remain replaceable adapters; AutoScraper can propose selectors but cannot certify extraction.
- Media direction: native non-destructive project/EDL, local transcript studio, semantic footage search, story/selects, approval-gated edits, optional effects workers, bounded render and cut-boundary QA. Video Use, FireRed-OpenStoryline and Herk Edit Kit are valuable workflow references, not wholesale framework dependencies.
- Licence/lifecycle gates: AutoScraper MIT; Crawlee Python Apache-2.0; Scrapy BSD-3-Clause; curl-impersonate MIT but explicitly excluded for stealth/anti-bot evasion; yt-dlp Unlicense repo with dependency licences and copyright/platform terms still applicable; FireRed-OpenStoryline Apache-2.0; AutoClip and Herk Edit Kit MIT reported pending exact identity pin; AutoSubs MIT code with optional MMS CC BY-NC 4.0 weights; StoryToolkitAI GPL-3.0 and lifecycle caution; FunClip/NarratoAI MIT reported; BackgroundRemover MIT; LatentSync Apache-2.0 code with separate model-weight restrictions.
- No authentication/paywall/CAPTCHA/access-control bypass, browser fingerprint spoofing, proxy rotation, cookie/session extraction, arbitrary URL crawling, unattended publishing or paid API dependency. SSRF protection, DNS/redirect validation, per-host rate limits, untrusted-content isolation, user consent, copyright and model-weight licence review are mandatory.
- No packages, models, binaries, media, external services or accounts were installed, executed, connected, uploaded or deployed.


### LitServe — optional local inference adapter (17 November 2026)

**Status:** Research only. Detailed assessment appended to `AEGIS_FORGE_WEB_INTELLIGENCE_MEDIA_PRODUCTION_INTAKE_2026-11-17.md`.

- Reviewed `Lightning-AI/LitServe`, Apache-2.0; upstream release v0.2.19 dated 9 September 2026.
- Candidate for Python model-serving workers with custom setup/prediction, batching, streaming, async handling, multi-model composition and optional OpenAI-compatible/MCP interfaces.
- Not a model runtime or drop-in Ollama/vLLM replacement. Self-managed authentication is DIY; managed autoscaling, multi-node, load balancing, scale-to-zero and managed observability must not be assumed free/self-hosted capabilities.
- Architecture: AEGIS control plane → Sentinel-authenticated private inference gateway → optional LitServe worker → pinned local model. AEGIS retains model routing, identity, memory, permissions, audit and decisions.
- Requires worker isolation, no public unauthenticated endpoints, strict request/queue/resource limits, cancellation/backpressure, pinned dependencies, SBOM, model-weight licence review and workload-specific benchmarking.
- No installation, model download, server launch or managed service activation. Compare against a minimal FastAPI worker before adoption.


### Learning Forge — immutable assessment registry (17 November 2026)

**Status:** Implementation committed to draft PR #103; CI verification pending.

- Added `migrations/forge/0012_learning_assessments.sql` for owner-scoped immutable assessment versions tied by composite foreign key to an exact registered Learning Path version.
- Registration emits one append-only event; database triggers reject assessment/event update and delete.
- Added `functions/lib/learning-assessment-store.mjs` with canonical JSON SHA-256 identity, idempotent registration, conflict rejection and bounded owner-scoped listing.
- Registration verifies that the exact path version exists and that the target node belongs to that version; it never silently resolves a moving "latest" path.
- Added authenticated same-origin `GET/POST /api/learning/assessments`. POST returns metadata only; GET uses the explicit learner projection and omits both answer keys and pass thresholds.
- Added store and migration contract tests. The first test commit preceded the implementation commit; CI has not yet confirmed the RED/GREEN sequence or the full suite.
- This is a trusted assessment catalogue, not yet a learner attempt endpoint or verified mastery system. Attempt persistence, rate/cooldown policy, server-side answer submission, revocation/supersession, and independent mastery verification remain future work.
- Passing an assessment does not grant permissions, tool access, agent autonomy, or any other capability.


### Learning Forge — server-scored attempts and adaptive next actions (17 November 2026)

- Added `migrations/forge/0013_learning_assessment_attempts.sql`: owner-scoped attempts bound to exact immutable assessment versions, append-only submission events, database-enforced cooldown and rolling rate limits, and immutable history.
- Added `functions/lib/learning-attempts.mjs` and authenticated same-origin `POST/GET /api/learning/assessments/attempts`.
- Server loads the trusted assessment and scores answers deterministically. Client-supplied score/pass/mastery fields are rejected. Attempts persist scores and assessment provenance only: no raw answers and no low-entropy answer digest.
- D1 enforces a 30-second cooldown and at most five attempts per assessment version in a rolling 15-minute window. Updates/deletes are rejected.
- Added `functions/lib/learning-recommendations.mjs`: explainable prerequisite-aware next actions prioritising review, reinforcement, continuation and eligible starts. It is pure and local; it does not mutate progress or certify mastery.
- Results and recommendations explicitly keep `masteryVerified: false`; no permissions, capabilities or autonomy follow from a score.
- CI run `44183737666` passed: 838 tests, 837 passed, zero failed, one skipped, with D1 migration/runtime/Forge checks.
- Follow-up CI run `44184401063` passed: 844 tests, 843 passed, zero failed, one skipped, with D1 migration/runtime/Forge checks.
- Remaining: independent mastery policy/certification, learner-specific identity, learner UI, attempt retention/deletion controls, persisted recommendations and spaced repetition.


### Learning Forge — independent mastery evidence candidate (17 November 2026)

- Added a deterministic, pure candidate policy requiring two distinct passed assessment attempts on separate UTC dates, applied-task evidence with a SHA-256 artifact digest, and an approving human review that references all qualifying evidence.
- Evidence must match the exact immutable path version/node; malformed, duplicate, future-dated and cross-version records are rejected.
- Output is `candidate_for_human_confirmation`; `masteryVerified` remains false. No certification, capability grant or autonomy follows.
- Structural validation is not evidence authentication. Trusted authoritative-store loading, reviewer identity/independence checks and artifact provenance verification are mandatory before any API/UI integration.
- Full CI passed on code commit `37be686edb42e9f482a936d4c8d46914448e890a` (workflow `44187738206`): **850 tests, 849 passed, 0 failed, 1 skipped**, plus all capability/runtime/Queue/Forge D1 migration and smoke checks.
- No production endpoint or learner UI was added.


### Learning Forge — adaptive spaced review (17 November 2026)

- Added a pure local scheduler using latest-per-UTC-day assessment attempts; same-day retries do not inflate successful review history.
- Failed checks reset the review sequence and suggest a one-day revisit; successful review days expand suggested intervals through 1, 3, 7, 14 and 30 days.
- Exact path-version binding, deterministic due dates, overdue state and explanatory reasons are included. Mastery remains false.
- No schedule persistence, notification dispatch or reminder consent is assumed.
- Full CI passed on code commit `8cd71ef048574c5eda7868f8e8b065ff9e161fd3` (workflow `44188619578`): **857 tests, 856 passed, 0 failed, 1 skipped**, plus all capability/runtime/Queue/Forge D1 migration and smoke checks.


### Learning Forge — chronology and review-schedule integrity hardening (17 November 2026)

- Mastery candidate generation now requires the approving human review timestamp to be strictly later than every evidence item it references. A complete but premature review returns `insufficient_evidence` with an explicit missing reason.
- The local spaced-review scheduler now rejects future-dated attempt projections relative to its supplied clock, in addition to validating canonical timestamps, score consistency, exact path revisions and duplicate attempt IDs.
- Review suggestions remain deterministic and local: latest attempt per UTC day, failure resets, 1/3/7/14/30-day successful-review intervals, and no progress mutation, mastery certification or notification dispatch.
- Full workflow [44189175803](https://github.com/LAURENCE1977/Aegis-/actions/runs/44189175803) passed on code head `3ee155670cce21e1504a1a6ba45ff36305633061`: **850 tests, 849 passed, 0 failed, 1 skipped**, with capability/runtime/Queue/Forge D1 migrations and smoke checks all successful.
- Full workflow [44188619578](https://github.com/LAURENCE1977/Aegis-/actions/runs/44188619578) separately passed the strict evidence-review chronology regression: **857 tests, 856 passed, 0 failed, 1 skipped**.
- Remaining trust boundary: the mastery candidate policy still consumes structured evidence and does not authenticate its provenance, prove reviewer independence or verify artifact contents. No production API, learner UI, certificate, capability grant, persisted review schedule or reminder service is introduced.

### Learning Forge — store-backed mastery evidence ingestion (17 November 2026)

- Added exact owner/path/version lookup through the immutable Learning Path registry; graph content is revalidated against its SHA-256 digest.
- Added an internal evidence loader that reads registered assessments and server-scored attempt records for the exact path revision/node. Attempt records are revalidated against their registered assessment content digest and their stored digest binding.
- Evidence is projected from authoritative attempt rows, not caller-supplied JSON. The loader rejects cross-owner/path/node records, malformed/future timestamps and oversized evidence sets.
- The store-backed candidate builder currently returns insufficient evidence unless separate applied-task and independent human-review evidence sources are available. Those sources are not yet implemented; no mastery certification or capability grant is possible.
- Regression proof: pre-fix workflow [44198022972](https://github.com/LAURENCE1977/Aegis-/actions/runs/44198022972) reproduced both digest-tampering failures. Full workflow [44198403611](https://github.com/LAURENCE1977/Aegis-/actions/runs/44198403611) passed on code head `5f1c9fca570e53865815484efb26dbacbe8a3bc8`: **855 tests, 854 passed, 0 failed, 1 skipped**, plus all capability/runtime/Queue/Forge D1 migration and smoke checks.
- Next trust work: content-addressed applied-task artifacts with retention controls; authenticated reviewer identity and separation-of-duties; then multi-learner tenancy. Do not expose a mastery API/UI until those are real.

### Agent AEGIS Companion — persistent profiles and immersive text mode (17 November 2026)

- Added immutable owner-scoped Companion Profile revisions, canonical SHA-256 verification, active-profile preferences and append-only profile/selection events.
- Added authenticated same-origin profile list/create/update/select APIs with optimistic concurrency and exact-version selection. Official Agent AEGIS remains reserved; custom profiles only alter presentation and bounded interaction preferences.
- Added warmth, humour, directness, initiative, response-detail and visual-preset controls. Profile settings are versioned; a saved profile's verified server-side settings take precedence over client values.
- Added a safe interaction-directive builder. It consumes only validated numeric/enum fields; free-text profile descriptions never enter model instructions. It explicitly preserves safety, privacy, truthfulness, permissions, memory scope, Sentinel and approval requirements.
- Added AG-UI validation and session-only style fallback when profile storage is unavailable. Only the five bounded style fields are accepted; arbitrary prompt or authority fields are rejected.
- Added full-screen responsive Companion Mode using the existing live chat nodes/history, close and Escape handling, focus restoration, reduced-motion support and idle/thinking/responding/error/disconnected presence feedback.
- The avatar remains a stylised 2D placeholder. Voice and microphone capture remain disabled; no lifelike human or 3D runtime is claimed.
- Added authenticated JSON export of all custom profile revisions, active selection, profile events and purge history.
- Added exact-phrase owner-requested purge. It removes custom revisions, preferences and profile events through a D1 batch; the retained purge audit contains owner scope, count and timestamp only, without profile identifiers or content. The count is captured inside the same batch before deletion to prevent a stale preflight count.
- Profile creation, active revision updates, selection and purge now commit as atomic D1 batches. Regression tests prove failed preference writes roll back profile revisions and audit events.
- The companion home now exposes export and purge controls only when the authenticated persistent profile store is available. Session-only profiles are not sent to persistent data endpoints.
- Production D1 has not been provisioned. Retention/expiry policy, multi-user tenancy, full accessibility preference integration, voice and lifelike avatar runtime remain open gates.
- Full workflow [44212082804](https://github.com/LAURENCE1977/Aegis-/actions/runs/44212082804) passed on code head `6a39ab246afff2212dbcd84eeab6d4d121a3d36e`: **904 tests, 903 passed, 0 failed, 1 skipped**, including isolated capability/runtime/Queue/Forge/Learning/Companion D1 migrations and smoke checks. The suite covers atomic profile writes, rollback on preference failure, single-registration privacy listeners and the purge count/delete transaction boundary. Isolated local D1 executes the same audit `INSERT … SELECT COUNT(*)` statement used by the purge store.


### OsintHunter — evidence graph and investigation UX patterns (18 November 2026)

- **Study, do not import:** MIT-licensed OsintHunter demonstrates a case-centred graph, modular source registry, alias-family suggestions, reasoned confidence, analyst feedback, timeline and report workflow.
- AEGIS-native opportunity: a provenance-rich Evidence Graph projection over canonical owner-scoped evidence, sources, claims, entities and events. Preserve observation time separately from event time; allow conflicting and retracted claims; make graph edges non-authoritative.
- Security holds: no unrestricted URL fetch/redirects, email account enumeration, bulk profile scraping, identity-by-photo, or unreviewed remote AI transfer. Static review found the upstream URL-fetch path lacks visible private-address/redirect enforcement and its API keys are stored in plaintext local settings.
- Any optional source adapter remains disabled until Sentinel scope, SSRF-safe egress, source policy, budgets, consent, cancellation and audit gates are implemented.
- Assessment: [AEGIS_OSINTHUNTER_RESEARCH_2026-11-18.md](AEGIS_OSINTHUNTER_RESEARCH_2026-11-18.md).
