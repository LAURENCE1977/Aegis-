# AEGIS INFINITY — Integration and Delivery Plan

**Status:** approved direction; staged engineering plan. This document does not claim the proposed capabilities are implemented.
**Date:** 24 November 2026.
**Repository:** https://github.com/LAURENCE1977/Aegis-

## 1. Delivery mandate

Continue the existing AEGIS project as the implementation foundation. Preserve its history, code, working integrations, security boundaries and useful feature branches. Do not restart the project or create parallel products for capabilities that belong in the shared platform.

The product direction is **AEGIS INFINITY**: one adaptive platform with two separately governed primary environments:

- **AEGIS PERSONAL** — individuals, families, children, students, older adults, accessibility, learning, communication and home/family safety.
- **AEGIS BUSINESS** — professionals, teams and organisations, with separate workspaces, identities, records, policies and administration.

Shared infrastructure and intelligence must not collapse the privacy boundary. Cross-environment transfer requires explicit authorisation and an auditable purpose.

## 2. Architecture ownership

| System | Responsibility |
|---|---|
| AEGIS INFINITY | Product platform, identity boundaries, shared contracts and infrastructure |
| ODIN | Planning, model/provider routing, task decomposition and orchestration |
| JARVIS | Conversational, voice, visual and multimodal user experience |
| Forge | Research, repository inspection, capability adaptation and engineering workflow |
| Guardian / Sentinel | Policy enforcement, permissions, approvals, safety and audit |
| AEGIS Everywhere | Cross-device continuity and client adapters |
| AEGIS Vision | Wearable, smart-glasses and spatial-computing adapter family |
| LawGuard | Jurisdiction-aware legal and policy checks before consequential actions |

Names describe architectural responsibilities; they do not imply that every component is implemented.

## 3. Existing foundation to preserve

The live README and current source describe an early Cloudflare Pages application with a mobile-first chat, session security, skills and module registries, read-only public GitHub discovery, an initial read-only MCP Bridge, a durable Worker job slice, Project Spaces, capability-policy foundations and plan-only agent orchestration.

Important limitations remain:

- The durable Worker and its D1/Queue resources are not production-deployed.
- The agent-run workflow creates deterministic plans; it does not yet run LLM specialists or tools.
- The capability policy evaluator is not yet a complete live grant/approval execution path.
- The Android/device bridge is development work, not proof that a physical phone is paired.
- The complete model router, general connector manager, voice engine and production Forge sandbox are not complete.
- Cloud/VM provisioning and paid services must remain disabled unless separately authorised.

The existing PRs #202–#205 form a dependent stack. Review and reconcile them as a stack; do not merge them independently or compare their cumulative diffs as if each PR contained all accumulated changes.

## 4. First end-to-end milestone

Deliver one safe, observable, end-to-end user journey before expanding specialist capability:

1. User submits a bounded task through the authenticated AEGIS interface.
2. ODIN validates the request, records the task in the correct Project Space and creates a durable plan.
3. The planner selects only registered specialist roles and declared capabilities.
4. Guardian/Sentinel evaluates identity, scope, resource, connection, budget and approval requirements.
5. In the first release, execution remains limited to explicitly allowlisted, harmless read-only actions. Any write or external side effect remains blocked or awaits exact-operation approval.
6. The runtime records state transitions, evidence references, errors and retry outcomes.
7. JARVIS presents a clear result: completed, partially completed, awaiting approval or blocked, with reasons.
8. Tests cover idempotency, retries, expired leases, denied permissions, missing services, quota exhaustion and recovery.

**Acceptance gate:** a real user task can travel through the complete path and return a verifiable result; tests prove both permitted and denied paths. A deterministic plan alone is not an end-to-end execution milestone.

## 5. Engineering sequence

### Stage A — Reconcile and stabilise
- Re-read AGENTS.md, the master blueprint, README, current branches, PRs and CI.
- Map each open PR to its parent, changed files, tests, dependencies and deployment assumptions.
- Identify duplicate, stale, blocked and overlapping branches.
- Reconcile the #202–#205 stack and the earlier runtime, project-space, capability and connector work.
- Update documentation to distinguish implemented source, tested source, preview deployment and production deployment.
- Do not close, retarget, merge or rewrite existing PRs without a reviewed reason and preserved recovery path.

### Stage B — Complete the governed workflow
- Connect durable job state, Project Spaces, agent-run records and user-visible status through canonical IDs.
- Finish the trusted Sentinel composition path for exact registered actions.
- Add bounded specialist delegation, model-provider adapters, task budgets and reviewer acceptance checks.
- Add a small, safe, read-only specialist workflow first.
- Require tests before behavior changes and run the repository's documented Node.js test suite.

### Stage C — Activate infrastructure safely
- Verify actual Cloudflare account resources, bindings, limits and current free-tier terms.
- Keep OCI/Cloudflare provisioning, production migrations, secrets, DNS and deployment as explicit gated operations.
- No paid fallback, billing change or resource creation without separate approval.
- Validate preview first; preserve rollback and a known-good production state.

### Stage D — Device and experience adapters
- Make the responsive web/PWA reliable on the user's Chromebook and Android phone.
- Add device pairing and observational capabilities only after the backend and client contracts are verified.
- Add voice capture/playback and background notifications with explicit OS permissions and realistic platform limitations.
- Add AEGIS Vision as a replaceable adapter family for compatible smart glasses and AR devices; do not bind the core to one manufacturer.
- Build Personal and Business environment separation into identity, storage, memory, project spaces and policy.

### Stage E — Human-centred capabilities
Deliver as shared core services with environment-specific policy and UX:
- Universal accessibility and alternative communication.
- Learning Companion and Senior Companion.
- Consent-based Memory Continuity and family communication.
- Scam/coercion awareness based on observable risk indicators, not AI lie detection.
- Family Guardian and Home Guardian with transparent pairing, proportionate alerts and safety controls.
- Universal Communication Engine, including validated BSL support before claiming sign-language competence.

### Stage F — Situational awareness and advanced integrations
- Evaluate public data, mapping, CCTV/NVR, road, environment and maritime connectors individually.
- Require source rights, licence, security, provenance, retention and privacy review.
- Treat public availability as distinct from permission to reuse.
- Build AEGIS GOD'S EYE only as governed situational awareness, never indiscriminate surveillance or population tracking.
- Treat facial/voice/body-language/micro-expression outputs as weak context only; never infer truth, guilt or deception.

## 6. Speech adaptation — learn the user's communication, not the phone's model

The assistant should reduce repeated clarification caused by speech-to-text errors by using conversational context and corrections.

### Current conversational behaviour
- Maintain a small working glossary of confirmed project names and technical terms, including AEGIS INFINITY, AEGIS, ODIN, JARVIS, Forge, Guardian, Sentinel, Virtual Core, Trust Gateway, AEGIS Vision and the user's repository names.
- Use the ongoing topic to resolve likely homophones and dictation substitutions when one interpretation is strongly supported.
- Learn from explicit user corrections and repeated, unambiguous usage.
- Preserve the user's intended meaning and natural speaking style; do not unnecessarily correct grammar or spelling in ordinary conversation.
- If two interpretations could materially change a technical action, ask one concise clarification rather than guessing.
- Do not treat a speech guess as authorisation for payments, external messages, deletion, permission changes, deployment or other consequential actions.
- Do not claim to retrain or control the device's speech-recognition engine. ChatGPT-side contextual interpretation and OS-level speech recognition are separate systems.

### Future AEGIS speech service
- Define a provider-neutral speech adapter for platform transcription, speech-to-text, text-to-speech and optional local vocabulary hints where supported.
- Keep user-approved vocabulary separate from raw transcripts; support review, correction and deletion.
- Do not silently create a permanent voiceprint or infer identity from conversational style.
- Audio capture must be explicit, visible and permissioned; avoid retaining raw audio by default.
- Measure correction accuracy and false-correction rate before enabling automatic normalisation.
- Retain the original user utterance where needed for audit of consequential instructions, while displaying a clear interpreted version.

## 7. AEGIS Vision — wearable and spatial device adapters

AEGIS Vision is a planned interface family, not a new intelligence backend.

- Support smart glasses and AR headsets through documented manufacturer APIs, standard web/mobile interfaces or authorised companion-device bridges.
- Capabilities may include voice interaction, contextual visual assistance, captions, navigation, reminders, object/text description and hands-free task guidance, subject to device hardware and platform permissions.
- Detect device capability at runtime; never promise camera, display, audio, hand tracking or background operation when the hardware/API does not expose it.
- Require clear camera/microphone indicators, user control, consent, minimal capture and short retention.
- Do not build covert recording, indiscriminate face identification or persistent tracking of bystanders.
- Use a common device capability contract so manufacturers remain replaceable.
- First validate a phone-mediated prototype and API compatibility before purchasing hardware or committing to a vendor.

## 8. Definition of done and operating rules

A capability is not complete until:
- implementation exists on a reviewed branch;
- tests demonstrate expected and denied behaviour;
- security, privacy, licensing and cost assumptions are recorded;
- CI passes;
- preview or device verification is completed where applicable;
- deployment state is stated accurately;
- rollback and owner control are documented.

Continue autonomously on reversible research, code review, tests, documentation and isolated feature-branch work. Pause for explicit approval before production deployment, paid resources, secrets, broad permissions, destructive changes, external communications or irreversible operations.

## 9. Immediate next actions

1. Complete the live PR/branch dependency audit and produce a file-level integration map.
2. Select the smallest safe implementation slice that closes the plan-only-to-verified-result gap.
3. Write failing tests first, implement the smallest change, run focused and full tests.
4. Open reviewable PRs with evidence; do not merge or deploy automatically.
5. Keep this plan and the master blueprint aligned with actual repository state.
