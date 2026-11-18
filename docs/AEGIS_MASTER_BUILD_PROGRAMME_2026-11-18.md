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

- PR #103 is open, draft and unmerged; latest verified code head at this checkpoint is `0f6f8d42f766bd5b69e698748b12b4525a7f2dad`.
- Push workflow [44313097341](https://github.com/LAURENCE1977/Aegis-/actions/runs/44313097341) and matching PR workflow [44313110573](https://github.com/LAURENCE1977/Aegis-/actions/runs/44313110573) both completed successfully for this head: all 24 workflow steps passed. The Node.js suite reported 958 tests, 957 passed, zero failed and one skipped; the separate Cloudflare runtime integration test passed. Runtime, capability, Forge, Eval, Learning and Companion D1 migration/constraint checks also passed.
- Current code includes durable agent-run submission/list/detail/timeline/cancellation, plan generation, immutable approval binding and a separate authorisation record.
- The queue consumer currently creates a plan and step records; it does not execute specialist work. The authorisation endpoint explicitly returns `executionStarted: false`. Keep this honest and do not enable specialist execution until Stage 2 safety and acceptance tests pass.
- Existing capability manifests, Sentinel mediation, provider registry, model adapters, Memory/Knowledge, Eval/Learning Forge and Companion foundations should be extended rather than duplicated.
- Stage 1 implementation now has a shared canonical run-intent validator, canonical plan contract, versioned bounded specialist manifests and a versioned plan-only task-envelope contract. Each specialist manifest declares its schema/manifest versions, task/output contracts, fixed plan-only mode, empty capability-request list and hard input/output/duration limits. The trusted task-envelope factory derives identity and execution mode from a validated plan and registered manifest, binds run/step/specialist/attempt/context digest, enforces bounded output/time budgets and fixed trust-boundary text, and grants no execution permission. A canonical durable run-record contract now validates lifecycle, cancellation, context, plan and authorisation bindings, and is enforced when the runtime serialises run records. The compact Project Space context reference has a named canonical validator; the existing evidence descriptor and Sentinel capability manifest validators remain the canonical evidence/tool contracts. The imported skill registry now emits validated, versioned, provenance-pinned guidance-only manifests with no permissions. A bounded read-only execution-receipt schema records digests, timing, output size and Sentinel decision metadata without storing payloads. Capability approvals now validate a versioned, exact-field permission request with a 15-minute maximum expiry; a request remains a proposal, never a grant.
- The Stage 1 cross-contract composition test now exercises the specialist → plan → run record → task envelope path alongside Companion Profile, Device Profile, guidance-only skills, exact permission requests and unsigned structural receipts. The owner API guard is also tested end-to-end: a valid signed owner session is accepted, while a correctly HMAC-signed token attempting to substitute another principal is rejected. These tests prove the current schemas compose without allowing companion/task/permission/receipt fields to self-grant authority.
- Signed sessions now carry canonical `1.0` claims: fixed single-owner principal `owner`, a UUID session ID, canonical issued/expiry timestamps and the existing 12-hour lifetime. The verifier rejects unsupported versions, unknown fields, altered principal identity, invalid IDs, future-issued sessions and invalid lifetimes. This is an identity contract for the current single-owner installation, not multi-user tenancy. Sessions remain stateless: individual session-ID revocation/persistence is not implemented.
- Stage 1 remains in progress: add API/runtime boundary tests proving the validated session principal is consistently used by owner-protected routes, then finish compatibility coverage for context/evidence, capability manifests and receipts at their actual API/runtime boundaries. Device and Companion Profile already have their own versioned validators; reuse them rather than adding duplicate profile schemas. The execution-receipt contract is structural only and unsigned; it is not emitted or persisted because the bounded worker does not exist. Existing Sentinel capability manifests and evidence descriptors remain authoritative rather than being duplicated.
- Current single-owner assumptions remain; do not describe the platform as a verified multi-tenant system.
- No production deployment is implied by CI success.

## Immediate next action

Stage 0 and Stage 1 contract gates are verified green. Stage 1 now has canonical, versioned contracts for run intent, plan, specialist manifest, skill manifest, task envelope, run record, context reference, evidence descriptor, permission request, session claims, receipt and device/companion profiles. The durable queue creates and persists one validated inert task envelope per specialist step. D1 enforces its schema version, plan-only mode, empty capability-request list, run/step/specialist row binding and immutability; runtime reads revalidate the persisted envelope against the step. Cross-contract tests also verify evidence descriptors remain owner-bound metadata and cannot inject content, storage paths or authority into tasks. Verified code head `38f76f10ebec8804f058db1d352aa259e5944bee`: push workflow [44350473762](https://github.com/LAURENCE1977/Aegis-/actions/runs/44350473762) and matching PR workflow [44350489254](https://github.com/LAURENCE1977/Aegis-/actions/runs/44350489254) both passed all 24 steps. Node.js suite: 966 tests, 965 passed, 0 failed, 1 skipped; real Miniflare/D1/Queue integration and capability, runtime, Forge, Eval, Learning and Companion D1 checks passed. Evidence descriptors remain metadata-only: no file upload, object storage or evidence retrieval API exists yet; that storage-backed capability belongs in the unified evidence work of Stage 3 and is not represented as complete. The receipt remains an unsigned structural contract and is not emitted/persisted until Stage 2. Stage 2 is now the next build gate; specialist execution remains disabled until its bounded worker, exact approval/grant/Sentinel path, attempt fencing, cancellation and receipt persistence are implemented and tested.


## Companion interface and 3D identity — required product work

The companion experience is a first-class release requirement, not a later cosmetic enhancement. The current page already has a responsive welcome experience, companion-first signed-in home, companion profile selection/custom profile creation and personality controls. Its current avatar is CSS presentation geometry only; it is not a functioning 3D avatar.

Design and implementation acceptance criteria for Stage 7:
1. Deliver a companion-centred application shell that feels like a personal environment, not a stack of administration tabs. Keep chat, projects, memory, approvals, Forge and security accessible as contextual surfaces without crowding the companion.
2. Build the official AEGIS identity as a recognisable, full-screen interactive human avatar. A decorative orb, generic robot symbol, static image or CSS-only silhouette does not satisfy this requirement.
3. Support user-created companion identities and customisation while retaining the shared AEGIS intelligence, memory, safety, permission and Sentinel core.
4. Evaluate local-first, open-format 3D assets/runtime against mobile Safari and desktop performance, accessibility, asset licensing, offline operation and long-term maintainability. No mandatory paid avatar provider or hosted service.
5. Add expressive idle states, gaze/head movement and conversation-state feedback; add voice and lip synchronisation only with explicit user control and consent.
6. Provide reduced-motion, low-power and non-3D fallback modes. Preserve accessibility and usable controls at small screen sizes.
7. Keep avatar assets, persona settings and optional voice data private, portable and user-governed.
8. Verify the real integrated experience on mobile and desktop. A render, mock-up or isolated 3D demo is not release completion.

Revisit the design as the intelligence, companion profile contracts, device adaptation and actual usage are built. The current dark interface and restrained cyan/teal accents are a starting language, not an unchangeable visual specification.


## Latest verified checkpoint — 18 November 2026, 16:25 UTC

- Current code head: `8c2d07d648c814b12cc4a4023c08970fd78dc5d5` on `feature/rea-open-source-security-learning-batch`.
- PR #103 remains open, draft, unmerged and based on the existing PR #101 integration branch. No production deployment or merge was performed.
- Push workflow [44346845686](https://github.com/LAURENCE1977/Aegis-/actions/runs/44346845686) and matching PR workflow [44346859793](https://github.com/LAURENCE1977/Aegis-/actions/runs/44346859793) both passed all 24 steps.
- Node.js suite: **964 tests, 963 passed, 0 failed, 1 skipped**. Cloudflare runtime/Queue integration and isolated capability, runtime, Forge, Eval Forge, Learning Forge and Companion Profile D1 checks passed.
- Added test-first runtime protections for persisted Project Space context: altered brief/knowledge content, missing context document with retained digest/project binding, and project-ID substitution all fail closed before plan or step creation. Integrity failures are terminal, append an audit event and do not enter transient retry handling.
- The RED/GREEN sequence is recorded in workflow history: the tampering regression failed against the previous retry behavior, then passed after the terminal integrity-failure path was added; the second regression exposed context removal/project-ID substitution, then passed after binding the context JSON, digest and project ID together.
- Stage 1 remains open. Remaining gate: evidence descriptor validation at the actual evidence-intake API boundary and final context/evidence-reference compatibility at task intake. Do not mark Stage 1 complete based on contract-level tests alone.
- Stage 2 specialist execution is still disabled. The queue currently creates plans and planned steps; it does not execute specialists. The execution receipt remains a structural unsigned contract and is not yet produced or persisted.
- Companion design requirements remain first-class: companion-centred personal environment, recognisable full-screen human 3D identity, custom personas, local-first runtime, accessibility, reduced-motion and non-3D fallback. No final 3D avatar is implemented yet.


## Stage 1 exit gate — passed 18 November 2026, 16:44 UTC

- Latest verified code head: `38f76f10ebec8804f058db1d352aa259e5944bee`.
- Push workflow [44350473762](https://github.com/LAURENCE1977/Aegis-/actions/runs/44350473762) and matching PR workflow [44350489254](https://github.com/LAURENCE1977/Aegis-/actions/runs/44350489254) both passed all 24 steps.
- Node.js suite: **966 tests, 965 passed, 0 failed, 1 skipped**. Real Miniflare/D1/Queue integration and all capability, runtime, Forge, Eval Forge, Learning Forge and Companion Profile D1 checks passed.
- Added runtime migration `0009_agent_step_task_envelopes.sql`. The queue now creates and persists one canonical task envelope for every planned specialist step. The runtime validates the envelope when reading a step; the D1 schema checks the version, plan-only mode, empty capability requests and exact run/step/specialist binding. A trigger makes the persisted envelope immutable.
- The real Cloudflare/Miniflare test applies migration 0009, processes a Queue message, validates the persisted task envelopes and verifies D1 rejects changed task definitions, unsafe execution modes and task identities that do not match their database row.
- Added cross-contract coverage proving evidence descriptors remain owner-bound metadata only, contain no file bytes/storage paths and cannot be smuggled into a specialist task as authority.
- Stage 1 contract gate is passed. This does **not** mean evidence storage is implemented: there is no upload, object-storage or evidence retrieval API yet. Keep evidence descriptors metadata-only and implement storage-backed intake as part of Stage 3's unified evidence work.
- The execution receipt remains a validated unsigned structural contract, not an emitted or persisted execution attestation. That work belongs to Stage 2.
- PR #103 remains open, draft and unmerged. No production deployment or merge was performed.

## Stage 2 — immediate implementation order

1. Build a bounded specialist worker interface that accepts only a validated persisted task envelope and minimum required untrusted context. Start with a tool-less response adapter.
2. Bind each attempt to the exact immutable plan digest, principal, specialist, task ID, attempt number, lease and cancellation state. A stale worker must never write a result for a newer attempt.
3. Enforce wall-clock timeout, abort propagation, output-byte cap, input-byte cap, concurrency cap and deterministic failure classification.
4. Keep model/provider transport replaceable. No raw credentials enter task payloads; no arbitrary shell, filesystem or unrestricted network access.
5. For any capability request, resolve the canonical registry manifest server-side and call Sentinel with the exact principal, resource, input digest, grant, connection and approval state. No model- or task-supplied authority.
6. Persist immutable per-attempt results and unsigned structural receipts first; add trusted signing/attestation only after key custody, rotation and verification design is reviewed.
7. Test cancellation/lease races, duplicate delivery, worker timeout, provider failure, oversized output, changed plan, expired/revoked grant, denied Sentinel calls and partial-write recovery in real D1/Queue integration.
8. Do not turn on specialist execution until every acceptance test passes. Human approval and Sentinel re-authorisation remain separate, mandatory gates.
