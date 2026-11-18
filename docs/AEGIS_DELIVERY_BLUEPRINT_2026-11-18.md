# Agent AEGIS — Delivery Schedule and Evolution Blueprint

**Baseline date:** 18 November 2026  
**Repository:** `LAURENCE1977/Aegis-`  
**Canonical implementation line:** draft PR #103, `feature/rea-open-source-security-learning-batch`  
**Status:** Active delivery plan. This is a dependency-ordered engineering schedule, not a claim that planned capabilities exist.

## 1. Delivery objective

Deliver **Agent AEGIS — Your Personal Guardian** as one modular, open-source-first personal intelligence system:

- One shared intelligence and orchestration core.
- One canonical identity, memory, task and evidence model.
- Sentinel as the only authority for permissions, approvals and execution.
- Forge as the controlled capability discovery, research, adaptation and engineering system.
- A first-class configurable companion over the shared core.
- Multiple replaceable execution and interface adapters: browser/PWA, local device, optional self-hosted services and optional external providers.
- A community ecosystem that can add capabilities without granting them implicit trust.

The architecture must not depend on Cloudflare, a single model provider, a particular agent framework, a proprietary hosted service or a single UI renderer. Cloudflare remains a useful initial adapter while portable contracts and alternate local/self-hosted adapters are built.

## 2. Non-negotiable design rules

1. **AEGIS owns authority.** Frameworks, models, agents, plugins, skills and protocols are replaceable workers/adapters. None can grant itself permissions.
2. **Sentinel authorises every consequential action.** Exact principal, capability, version, action, resource, scope, expiry, risk and approval are checked server-side at execution time.
3. **Planning is not execution.** A generated plan, a human approval and an execution authorisation are separate states. An approval never silently starts work.
4. **Default deny.** Missing policy, identity, provenance, storage or audit means no execution.
5. **Human control.** Inspect, pause, cancel, revoke, export and delete. Production, destructive, external, costly and security-sensitive actions require explicit approval.
6. **Free-first and portable.** No paid API, subscription, hosted model or proprietary cloud is mandatory for core operation. Optional services are disabled by default, replaceable and budget-gated.
7. **Privacy by default.** Owner/workspace isolation, minimum data, visible egress, no covert device inventory or recording, and explicit retention/deletion controls.
8. **Evidence over claims.** Every capability carries provenance, licence, version, test evidence, limitations and status.
9. **TDD for behaviour.** Write a failing regression test, implement the smallest fix, then run focused and full integration checks.
10. **No automatic production changes.** Branches, previews, migration rehearsals and rollback first. Merge and production deployment remain explicit human decisions.

## 3. Target architecture

### Experience layer
Agent AEGIS companion, chat, voice, accessible 2D/3D presentation, workspace and device-specific clients. All clients use the same core identity, task history, memory and policy.

### Intelligence core
Intent understanding, planning, context assembly, retrieval, model selection, evaluation, learning and capability discovery. Models provide reasoning proposals; they do not own policy or durable truth.

### Sentinel security plane
Authentication, session/device identity, tenancy, capability grants, approvals, risk rules, rate limits, secret references, revocation and append-only audit.

### Memory and knowledge plane
Owner/workspace-scoped facts, preferences, decisions, events, documents, source provenance, confidence, temporal validity, supersession, correction, retraction, export and deletion.

### Forge and evolution plane
Repository/source inspection, capability registry, licence/security review, architecture extraction, candidate adaptation, sandboxed tests, evaluation, versioning and upgrade proposals.

### Execution plane
Durable task/run state, queues, isolated workers, bounded tools, checkpoints, retries, cancellation, output validation and execution receipts. Local, Cloudflare and self-hosted runtimes are adapters behind the same contracts.

### Interoperability and device plane
Versioned APIs and optional MCP, AG-UI, A2A/ACP and provider adapters. A privacy-preserving device capability profile selects a supported quality tier without fingerprinting.

## 4. Dependency-ordered delivery schedule

Estimates are focused engineering effort, not calendar promises. They assume one primary implementation stream using automated coding/review assistance. Integration, device testing and security review can extend the elapsed time. A stage is complete only when its exit checks pass.

| Stage | Estimate | Priority | Deliverable |
|---|---:|---|---|
| 0. Baseline and trust gates | 1–2 weeks | P0 | Reconciled branch/PR, reliable agent-run plan/approval/authorisation lifecycle, tenant and data boundaries |
| 1. Versioned contracts | 1 week | P0 | Closed, versioned task/agent/skill/tool/memory/device/companion/receipt contracts |
| 2. Capability and skill lifecycle | 1–2 weeks | P0 | Discover → inspect → licence/security review → test → approve → pin → enable → monitor → revoke |
| 3. Safe execution runtime | 2–3 weeks | P0 | Isolated worker, scoped host bridge, budgets, cancellation, receipts, replay/idempotency and recovery |
| 4. AEGIS Evolution Engine | 2 weeks | P1 | Capability gap detection, research synthesis, combination proposals, experiments and gated upgrade proposals |
| 5. Agent workforce and workspace | 2 weeks | P1 | Specialist profiles, task board, dependencies, handoffs, parallel workspaces and review |
| 6. Memory and knowledge completion | 1–2 weeks | P1 | Evidence provenance, temporal validity, correction/retraction, retention, cross-owner tests and offline sync design |
| 7. Local/offline intelligence | 2 weeks | P1 | Local model adapter, deterministic provider policy, local-first data and offline queue/reconciliation |
| 8. Companion interaction | 2–3 weeks | P1 | Consistent companion state, voice consent and interruption, speech pipeline and expressive avatar contract |
| 9. Adaptive device shell | 1–2 weeks | P2 | Responsive PWA, feature-based device tiers, accessible fallbacks and performance adaptation |
| 10. Guardian and personal automation | 2 weeks | P2 | User-authorised monitoring, scam/privacy/security assistance and bounded device/service automation |
| 11. Multi-device and ecosystem | 2–3 weeks | P2 | Pairing/revocation, secure handoff, self-hosting, signed updates and contribution review |
| 12. Release hardening | 1–2 weeks | P0 before public release | Threat model, SBOM, licence notices, migration/rollback rehearsal, accessibility and end-to-end acceptance |

**Indicative total:** approximately 19–27 focused engineering weeks, with some stages able to overlap after their dependencies are met. Do not compress security, identity, licensing or real-device verification to meet a date.

## 5. Stage-by-stage implementation and acceptance

### Stage 0 — Baseline and trust gates

Existing foundations include signed owner sessions, capability grants and approvals, plan-only agent runs, durable run events, cancellation, project context, rate limits, and isolated D1/Queue tests.

Finish:
- Reconcile stacked PRs and identify one canonical reviewable change set; do not merge duplicates.
- Verify run submission, listing, detail, event pagination, bounded replay, cancellation and idempotency.
- Verify plan intent is immutable across approval; changed plan, principal, resource, grant or expiry invalidates the approval.
- Verify approval consumption is one-time and separate Sentinel re-authorisation is required.
- Verify revocation/expiry and cancellation races fail closed.
- Define the identity/tenancy migration path before any multi-user rollout. Current `owner` identity is a single-owner boundary, not a multi-user identity system.
- Keep specialist execution disabled until the safe execution worker and its end-to-end threat tests exist.

**Exit:** all plan/approval/authorisation invariants pass; no execution bypass; migration and recovery behaviour tested; production remains separately gated.

### Stage 1 — Versioned contracts

Define closed schemas and compatibility rules for:
- Principal and device identity.
- Task, plan, run, step, handoff and execution receipt.
- Agent/specialist profile and skill manifest.
- Capability/action request and Sentinel decision.
- Memory evidence, knowledge record and source provenance.
- Device capability profile and companion profile.
- Evaluation suite, result and upgrade proposal.

Every contract has a stable ID, `schemaVersion`, bounded fields, explicit optional fields, unknown-field rejection, canonical digest rules and migration tests. Keep provider-specific payloads inside adapters.

**Exit:** invalid/unknown fields, unsupported versions, unsafe URLs, unbounded payloads and malformed digests are rejected at every trust boundary; compatibility tests cover supported versions.

### Stage 2 — Capability and skill lifecycle

Implement an AEGIS-owned lifecycle:
`discover → deduplicate → inspect → provenance/licence review → static analysis → risk review → isolated test → human approval → sign/pin → enable → monitor → revoke`.

Repository content is untrusted data. Use syntax-aware static analysis and metadata inspection; do not execute unknown code in the control plane. Skills declare requested capabilities but never receive permissions from their own manifest.

**Exit:** untrusted sample repositories cannot access secrets, control-plane data, host filesystem or unrestricted network; all imported assets have pinned source, licence status and audit lineage.

### Stage 3 — Safe execution runtime

Build a narrow worker interface shared by Cloudflare, local and self-hosted adapters:
- Typed task envelopes and strict input/output schemas.
- Separate read, write and execute permissions.
- Per-run time, memory, CPU, output, network and cost budgets.
- Default-deny filesystem and network; explicit host capabilities only.
- Checkpoints, lease fencing, retry limits, idempotency and durable cancellation.
- Redacted logs, immutable event lineage and signed/verified execution receipts.
- Human approval for external writes, destructive changes and production actions.

Benchmark WASM runtimes such as Extism and QuickJS WASM as isolated execution candidates; select only after reproducible escape, resource, compatibility and footprint tests.

**Exit:** malicious test workloads cannot escape the worker or reach secrets; cancellation and revocation take effect; retries cannot duplicate protected side effects; receipts bind the exact task, worker, inputs, outputs and policy decision.

### Stage 4 — AEGIS Evolution Engine

Build an internal improvement loop, not autonomous self-modification:
1. Compare desired user outcomes with the current capability registry.
2. Identify a capability gap and its evidence.
3. Search approved public sources and Knowledge Forge records.
4. Extract mechanisms and compare build/adapt/connect/reject options.
5. Propose a native AEGIS contract and smallest useful implementation.
6. Generate a test plan, threat model, licence assessment and resource estimate.
7. Run isolated experiments and fixed Eval Forge suites.
8. Produce a signed evidence report and upgrade proposal.
9. Ask for human approval before privileged changes, dependency adoption, merge or deployment.
10. Monitor the approved change and support rollback.

The engine may create branches and isolated prototypes within an explicitly granted workspace. It may not self-grant, alter Sentinel policy, access secrets, merge PRs or deploy.

**Exit:** repeatable gap-to-proposal workflow; evidence and licence provenance retained; evaluations reproducible; adversarial prompts and malicious source content cannot override policy; no autonomous production mutation.

### Stage 5 — Agent workforce and workspace

Create specialist roles as configurable workers under one authority: research, engineering, security, reviewer, creative production, personal organisation and learning. Add task dependencies, ownership, bounded parallel work, isolated workspaces/branches, handoffs and review. Users can inspect what each worker is doing and which sources/tools it used.

**Exit:** workers cannot overwrite each other's work, elevate permissions or hide tool activity; integration requires tests and human review.

### Stage 6 — Memory and knowledge completion

Unify memory and Forge knowledge behind canonical evidence records. Add confidence and source quality, observed/valid times, supersession, correction/retraction, retention, export and deletion. Evaluate local indexing and vector retrieval as replaceable indexes, never competing sources of truth. Add offline user-data sync; keep security and task authority server-authoritative.

**Exit:** cross-owner isolation, stale/retracted evidence, prompt-injection, export/deletion and offline conflict tests pass.

### Stage 7 — Local/offline intelligence

Add provider/model metadata and deterministic routing based on task type, privacy, user choice, capability, latency, quality and cost. Build local inference adapters for supported devices/self-hosted runtimes. Unknown prices remain unknown; paid providers are opt-in and hard-budgeted.

**Exit:** user can disable all paid providers; documented core workflows remain usable locally/offline where hardware supports them; routing and budget tests pass.

### Stage 8 — Companion interaction

Complete the first-class companion contract before selecting a rendering stack. Implement turn state, interruption, push-to-talk, VAD, mute, consent and clear recording/egress indicators. Browser/native speech is the fallback. Benchmark voice systems and 2D/3D renderers on real target devices. Keep text and non-avatar modes fully usable.

**Exit:** voice is immediately interruptible; capture requires user action and consent; retention is visible; reduced-motion/accessibility and low-device fallback tests pass.

### Stage 9 — Adaptive device shell

Build a privacy-preserving feature capability profile, not a device fingerprint. Select accessible text, 2D, standard 3D and optional advanced/XR tiers. PWA first; add native adapters only when platform demand and tests justify them.

**Exit:** essential flows work on iPhone, iPad and Chromebook-class devices without WebGPU or 3D; user can override adaptation; no covert hardware/app inventory.

### Stage 10 — Guardian and automation

Expand Guardian into scam/phishing analysis, permission/privacy explanation, authorised account monitoring and user-controlled security alerts. Add smart-home and other device automation through narrow adapters. No covert surveillance, unauthorised account access or hidden action.

**Exit:** each source and action is authorised, visible, revocable and audited; false positives and emergency stop are tested.

### Stage 11 — Multi-device and community ecosystem

Add secure device pairing, per-device grants, revocation and task handoff. Add self-hosting, signed updates, SBOM, licence notices, vulnerability response, contribution review and capability publishing. Shared skills/agents never carry user memory or credentials.

**Exit:** lost-device revocation, update rollback, migration rehearsal, contributor threat checks and self-host installation tests pass.

### Stage 12 — Release hardening

Complete independent threat review, accessibility, performance, backup/restore, privacy/retention, licence and dependency review, end-to-end critical flows and disaster recovery. Publish an honest feature matrix distinguishing local, optional hosted, experimental and unavailable capabilities.

**Exit:** all release-blocking checks pass and an explicit human release approval is recorded.

## 6. What stays replaceable

- Cloudflare Pages/Workers/D1/Queues: current deployment adapter, not the product architecture.
- Composio: optional service connector, never AEGIS intelligence or policy authority.
- OmniRoute: optional model transport/router, never canonical routing policy.
- MCP, AG-UI, A2A and ACP: protocol adapters behind AEGIS contracts.
- External agent frameworks: isolated worker backends, never the source of truth.
- Local model engines, vector indexes, voice systems and renderers: benchmarked adapters.
- D1: current structured store; evaluate portable storage adapters only when concrete needs justify migration.

Do not add overlapping frameworks just because they are popular. A dependency must demonstrate a capability gap, licence compatibility, measurable benefit, bounded risk and an exit strategy.

## 7. Immediate build queue

Work sequentially, one verified slice at a time:

1. Finish the current PR/branch verification and record the real status of plan, approval, Sentinel authorisation and runtime execution.
2. Close the capability manifest schema against unknown fields and document its compatibility contract. This is the first active code slice.
3. Add versioned contracts for task/run, agent/skill and execution receipts, with canonical validation and migration tests.
4. Complete the remaining Gate 0 approval/revocation/cancellation race coverage.
5. Implement the reviewed skill lifecycle and non-executing repository analysis.
6. Build the sandbox/worker prototype and prove its isolation before enabling specialist execution.
7. Implement the Evolution Engine on top of the verified registry, Forge, Knowledge Forge and Eval Forge.
8. Build workforce UI and task handoffs.
9. Complete identity/tenancy and memory controls before exposing a multi-user ecosystem.
10. Continue local intelligence, companion, devices and Guardian in the dependency order above.

After each slice: RED regression test → implementation → focused tests → full Node/runtime/D1 CI → update this blueprint with commit and evidence. A failed CI is a defect to investigate, not a milestone to count.

## 8. Progress reporting format

Report only:
- **Verified complete:** implementation, commit and test evidence.
- **In progress:** exact slice and branch.
- **Not built:** important missing capability.
- **Blocked by:** concrete dependency or approval.
- **Next:** one immediate implementation step.

Do not report a single overall percentage unless it is calculated from a fixed set of acceptance checks. Documentation and repository research do not count as implementation progress.

## 9. Approval boundaries

The build may create and update feature branches, tests, source code, documentation and preview builds within existing authorisation. It must not merge PRs, deploy production, provision billable resources, enable paid providers, alter production secrets, execute untrusted repositories, or make irreversible/destructive changes without explicit approval.
