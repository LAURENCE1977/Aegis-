# Agent AEGIS — Master Build Programme
**Baseline checked:** 18 November 2026  
**Repository:** https://github.com/LAURENCE1977/Aegis-  
**Working branch:** `feature/rea-open-source-security-learning-batch`  
**Current integration:** Draft PR #103; do not merge or deploy without explicit approval.

## Mission and architectural decision

Build Agent AEGIS as a universal, adaptive, human-centred personal intelligence system: companion, guardian and capable agent platform. AEGIS owns identity, policy, memory, task state, capability definitions, orchestration, provenance and audit. Cloudflare is a replaceable hosting/runtime adapter, not AEGIS's architecture. Local/self-hosted execution must remain a first-class option. No paid API, subscription or proprietary hosted service may be mandatory for core use.

One intelligence core, many replaceable surfaces and execution environments:
- Experience: responsive web/PWA, companion, voice, desktop/mobile adapters.
- Intelligence: planning, model/provider policy, context assembly, memory and evaluation.
- Trust: Sentinel, identity, grants, approvals, revocation, budgets and audit.
- Knowledge: Memory Substrate, Knowledge Forge, evidence and learning.
- Execution: durable task/run engine, specialists, queues and isolated capability workers.
- Evolution: capability-gap discovery, research, native adaptation, experiments and evaluation.
- Adapters: Cloudflare, local runtime, model providers, MCP/A2A, storage and device integrations.

No agent, model, imported skill or extension may grant itself permissions. Every consequential action must be re-authorised by Sentinel for the exact principal, capability, resource, scope, input digest, expiry and risk. Human approval remains mandatory for protected actions.

## Delivery schedule and priority order

Estimates are focused engineering effort, not calendar guarantees. Each stage is sequential at its dependency boundary; independent research can happen in parallel but cannot bypass a gate.

| Stage | Priority | Focus | Estimate | Exit gate |
|---|---:|---|---:|---|
| 0 | P0 | Stabilise current foundations and close safe agent-run lifecycle gaps | 3–5 days | Owner isolation, plan/approval separation, cancellation, replay, audit and D1/runtime tests pass |
| 1 | P0 | Canonical versioned contracts and capability/specialist registry | 4–7 days | Task, run, agent, skill, tool, context and receipt schemas validated at trust boundaries; compatibility tests pass |
| 2 | P0 | Sentinel-governed bounded specialist execution | 1–2 weeks | Exact plan approval + grant + Sentinel re-authorisation required; bounded execution, leases, retries, cancellation and receipts tested |
| 3 | P1 | Unified memory, knowledge and learning intelligence | 1–2 weeks | Evidence provenance, temporal validity, correction/retraction, retrieval safety, owner isolation and retention controls pass |
| 4 | P1 | AEGIS Evolution Engine | 1–2 weeks | Finds capability gaps, researches candidates, scores evidence/licence/security, proposes native adaptations and runs isolated evaluations; cannot self-approve |
| 5 | P1 | Specialist workforce and shared task environment | 1–2 weeks | Research, planning, engineering, security, creative and personal-organisation roles; visible handoffs, budgets and independent workspaces |
| 6 | P1 | Provider-neutral routing and local/offline intelligence | 1–2 weeks | Local mode, optional provider adapters, privacy/cost ceilings, deterministic fallback and offline queue verified |
| 7 | P1 | Complete companion interaction, then voice and embodiment | 2–3 weeks | Reliable accessible text/2D companion first; consent-controlled speech, interruption and voice/avatar separation; 3D optional |
| 8 | P2 | Adaptive device shell, integrations and personal automation | 1–2 weeks | Chromebook/iPhone/iPad baseline, explicit device capabilities, scoped connectors and visible automation approvals |
| 9 | P0 release gate | Security, tenancy, privacy, reliability and release readiness | 1–2 weeks | Multi-user isolation, deletion/retention, threat tests, SBOM/licence review, recovery, backup and rollback pass |

Expected focused effort: approximately 11–18 weeks, excluding unknowns such as lifelike avatar assets, advanced local-model hardware, broad third-party integrations and external review. Re-estimate at every stage exit using actual test and implementation evidence.

## Stage definitions and build instructions

### Stage 0 — Stabilise what exists
Verify the live PR/branch, full CI, migrations, runtime and Queue integration. Reconcile stale roadmap status. Audit the run lifecycle from submit → plan → approval request → human decision → exact Sentinel grant/re-authorisation → queue → bounded execution → result/receipt. Until the execution worker exists, keep the current plan-only behavior and explicitly report execution as unavailable. Test idempotency, changed-plan invalidation, replay, expired/revoked grants, cancellation races, owner isolation, leases, retries and append-only audit. No production provisioning/deployment in this stage.

### Stage 1 — Contracts before more features
Create canonical, versioned contracts for principal/session, task envelope, run, specialist/agent manifest, skill/tool manifest, context/evidence reference, permission request, execution receipt and device/companion profile. Validate exact fields, bounds, timestamps, stable IDs, schema versions and compatibility. Derive specialist catalogue and capability requests from registry data; registry declarations are requests, never grants. Add migration/compatibility tests. Avoid parallel duplicate schemas.

### Stage 2 — Safe execution
Build a bounded worker interface and specialist adapter contract. Worker input is a validated task envelope plus minimum required untrusted context; worker receives no raw credentials, unrestricted filesystem or arbitrary network. Every tool call passes Sentinel. Start with low-risk, read-only, first-party capabilities. Enforce execution budgets, timeouts, output limits, cancellation, attempt fencing, lease recovery and immutable receipts. Add write-capable adapters only after individual risk, scope, approval and rollback tests. External agent frameworks remain optional isolated adapters.

### Stage 3 — Unified intelligence
Connect owner-scoped memory, Project Spaces, Knowledge Forge, Guardian, Eval Forge and Learning Forge through shared evidence contracts. Retrieval must return bounded evidence with source, version, confidence, time validity and limitations. Retrieved content remains untrusted data. Implement correction, retraction, export, deletion, retention and cross-owner tests before broad ingestion. Keep mastery unverified until applied work and independent reviewer identity are authoritative.

### Stage 4 — AEGIS Evolution Engine
Build an AEGIS-native loop: observe user/task capability gaps → describe opportunity → discover candidate mechanisms → pin source/version → REA and licence/security review → compare build/adapt/connect/reject → design a minimal native experiment → isolated test/benchmark → Eval Forge evaluation → human review → signed/versioned proposal → controlled release. It must never install dependencies, execute untrusted code in the control plane, change its own Sentinel policy, grant itself permissions or deploy itself. It should inspect mechanisms, not merely README claims, and record evidence and limitations.

### Stage 5 — Workforce
Represent specialists as profiles over one intelligence core, not separate authorities. Build visible task ownership, dependencies, handoffs, independent workspaces, review gates and resource budgets. Parallelise only independent work. Merge/release actions require human review and tests. Add specialist types only when a measurable workflow benefits.

### Stage 6 — Local-first intelligence
Keep provider transport separate from model selection policy. Route by task fit, user preference, privacy, capability, latency and known cost. Unknown cost is not zero. Build local inference adapters and graceful offline mode; paid providers remain opt-in and budget-gated. Evaluate models against fixed tasks and preserve user choice.

### Stage 7 — Companion
Complete a dependable text/2D companion before 3D. Preserve official AEGIS identity and user-created personas, with profile portability and privacy controls. Add speech input/output with clear microphone state, push-to-talk, mute, immediate interruption and no hidden recording. Benchmark voice and render engines on target devices; 3D/XR are optional enhancements, never the only interface.

### Stage 8 — Devices and automation
Build privacy-preserving feature detection and user-approved device capabilities; no fingerprinting or covert app/file inventory. Integrate connectors through narrow manifests and Sentinel. Automations must be inspectable, pausable, cancellable and revocable, with visible schedules, egress and effects. Support browser-first, self-hosted and local modes.

### Stage 9 — Release gate
Implement true multi-user identity/tenancy and independent reviewer identity before multi-user claims. Verify export/deletion/retention, session/device revocation, backup/restore, incident handling, dependency/model/dataset/asset licences, SBOM, security scanning, migration rollback and accessible mobile workflows. Preview deployment and production deployment are separate; production requires explicit user approval.

## Build operating rules

1. Work in this priority order. Do not start later-stage feature work if it depends on an unfinished earlier gate.
2. For behavior changes, use test-first RED → GREEN → REFACTOR. Run focused tests, then the full repository CI and D1/runtime integration checks.
3. Every stage has a measurable acceptance checklist and an evidence record; never mark a stage complete on documentation alone.
4. Keep external frameworks optional and replaceable. Rebuild only the useful mechanisms AEGIS needs.
5. Prefer one canonical store/schema per domain; no duplicate memory, policy or task authority.
6. Keep free/open-source core requirements, licence review, provenance and cost disclosure mandatory.
7. No arbitrary shell, uncontrolled network, self-modifying policy, automatic dependency installation or self-deployment.
8. No merge, production secret changes, destructive operation, paid service activation or production deployment without explicit approval.
9. Report only verified outcomes: implemented, tested, previewed, deployed; identify limitations and next gate.
10. At each stage exit, refresh this schedule from actual progress, not optimistic percentages.

## Baseline checked 18 November 2026

- PR #103 is open, draft and unmerged; latest verified code head at this checkpoint is `07a691525b6d51ffe94c5a791bbee0b374a4cda7`.
- Push workflow `44306125342` and matching PR workflow `44306131945` both completed successfully for this head: all 24 workflow steps passed. The Node.js suite reported 950 tests, 949 passed, zero failed and one skipped; the separate Cloudflare runtime integration test passed. Runtime, capability, Forge, Eval, Learning and Companion D1 migration/constraint checks also passed.
- Current code includes durable agent-run submission/list/detail/timeline/cancellation, plan generation, immutable approval binding and a separate authorisation record.
- The queue consumer currently creates a plan and step records; it does not execute specialist work. The authorisation endpoint explicitly returns `executionStarted: false`. Keep this honest and do not enable specialist execution until Stage 2 safety and acceptance tests pass.
- Existing capability manifests, Sentinel mediation, provider registry, model adapters, Memory/Knowledge, Eval/Learning Forge and Companion foundations should be extended rather than duplicated.
- Stage 1 implementation now has a shared canonical run-intent validator, canonical plan contract, versioned bounded specialist manifests and a versioned plan-only task-envelope contract. Each specialist manifest declares its schema/manifest versions, task/output contracts, fixed plan-only mode, empty capability-request list and hard input/output/duration limits. The trusted task-envelope factory derives identity and execution mode from a validated plan and registered manifest, binds run/step/specialist/attempt/context digest, enforces bounded output/time budgets and fixed trust-boundary text, and grants no execution permission. A canonical durable run-record contract now validates lifecycle, cancellation, context, plan and authorisation bindings, and is enforced when the runtime serialises run records. The compact Project Space context reference has a named canonical validator; the existing evidence descriptor and Sentinel capability manifest validators remain the canonical evidence/tool contracts. The imported skill registry now emits validated, versioned, provenance-pinned guidance-only manifests with no permissions. A bounded read-only execution-receipt schema records digests, timing, output size and Sentinel decision metadata without storing payloads.
- Stage 1 is still in progress: complete permission-request and device/companion profile compatibility contracts, then exercise all canonical contracts together at API/runtime boundaries. The execution-receipt contract is structural only and unsigned; it is not yet emitted or persisted because the bounded worker does not exist. Existing Sentinel capability manifests and evidence descriptors remain authoritative rather than being duplicated.
- Current single-owner assumptions remain; do not describe the platform as a verified multi-tenant system.
- No production deployment is implied by CI success.

## Immediate next action

Stage 0 verification is green. Stage 1 is underway: shared run-intent and plan contracts, versioned bounded specialist manifests, plan-only task-envelope validation and factory, canonical run-record enforcement, context-reference validation, versioned guidance-only skill manifests and a bounded read-only receipt contract are implemented and covered by full green push/PR CI. Next, complete permission-request and device/companion profile compatibility, then run cross-contract boundary tests. Receipt signing/persistence and specialist dispatch remain Stage 2 work; keep execution disabled. Do not add new model providers or specialist execution as a shortcut.
