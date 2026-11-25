# Aegis-DSL and Semantic Edge-Mesh (SEM)

**Status:** Architecture direction adopted; implementation is incremental and evidence-gated.
**Applies to:** AEGIS INFINITY, including ODIN orchestration and the existing Cloudflare Pages/D1 deployment shape.

## Architectural intent

Aegis-DSL is the domain model and policy vocabulary for AEGIS. Semantic Edge-Mesh (SEM) is the proposed deployment and communication architecture: authenticated edge services, typed domain operations, explicit capability boundaries, and durable state with provenance.

These names do not authorize a wholesale rewrite. Existing Pages Functions, D1 schemas, KV bindings, MCP bridge, Runtime Worker, capability grants and authentication contracts remain authoritative until a migration is separately designed, tested, reviewed and approved.

## Core invariants

1. **Owner authority:** only authenticated, explicitly authorized owner actions may change protected state.
2. **Fail closed:** missing policy, invalid provenance, unavailable security dependencies or unclassifiable payloads must not silently permit writes.
3. **Taint by default:** user input, retrieved documents, external sources, model output and tool output are untrusted data. They are never instructions or permissions.
4. **Typed boundaries:** validate request, domain and persistence schemas at every boundary. Type safety supplements, but never replaces, runtime authorization.
5. **Auditable change:** migrations and configuration changes are versioned, reviewable and verifiable; production writes require explicit approval.
6. **Deterministic UI:** interface state is derived from validated server state and explicit finite-state transitions, not optimistic security assumptions.
7. **Least privilege:** agents receive narrowly scoped, short-lived capabilities and cannot grant themselves authority.
8. **Compatibility first:** preserve existing route contracts and data until an evidenced migration plan proves a safe transition.

## Paradigm register

| Paradigm | Target design | Current decision |
|---|---|---|
| End-to-end type-driven RPC | Typed domain clients over authenticated edge operations; generated contracts and runtime validation | Future architecture. Do not delete existing REST/Pages routes until a compatibility adapter and client migration are proven |
| Declarative migration AST | Typed schema model generates deterministic SQL diffs; generated SQL remains reviewable and is applied through versioned migrations | Future tooling. SQL migrations remain the production source of truth; no auto-apply to live D1 |
| FSM-driven UI / Eve state | Explicit state graph for IDLE, ANALYZING, ALERT, LOCKDOWN, driven by validated server events | Backend state currently supports IDLE, ANALYZING, ALERT; LOCKDOWN is an operational mode, not yet a UI/avatar state. No 3D avatar implementation is implied |
| Orthogonal persistence | Durable domain records, lifecycle events and recoverable projections | Incremental D1/KV design; D1 is not assumed to be a global sub-millisecond memory bus |
| Zero-knowledge session continuity | Minimise server-held identity data; cryptographically bind session and capability proofs | Existing HMAC sessions are revocable through D1. They are not zero-knowledge and no such claim is made |
| Information-flow control | Explicit trust labels and controlled declassification at model, log, audit and persistence boundaries | Initial memory ingestion labels all incoming memory as untrusted; broader taint propagation is planned |
| Ephemeral capability tokens (ESCT) | Single-use, audience-bound, action-scoped token with maximum 30-second TTL, replay protection and server-side grant check | Design target only; not implemented by the current login/session tokens |
| Behavioral biometric Sentinel | Optional, consent-based, privacy-minimising anomaly signals | Deferred; no keystroke or mouse cadence telemetry is collected |
| Golden State Manifest | Signed/hash-chained manifest of approved configuration and schema; drift detection and owner-approved rollback | Design target. No autonomous rollback or mutable-state overwrite is enabled |
| Canary tripwires | Harmless synthetic markers in isolated decoy surfaces; bounded alerting and owner-approved response | Step 2.6 preparation only; never use real credentials or expose production secrets |
| Supply-chain ledger | SHA-256 digests of migrations/configuration, ordered manifest and CI verification | Planned. Git history and current CI remain the existing baseline |

## Security data model

- **Trusted instructions:** code-reviewed policy, server-owned configuration and explicit owner-approved actions.
- **Untrusted data:** browser inputs, conversation content, retrieved memory, files, web pages, model output and external tool results.
- **Derived data:** transformations of untrusted data remain tainted unless a documented validation/declassification rule applies.
- **Persistence rule:** untrusted material may be retained only as data, with provenance and lifecycle status; it cannot mutate policy, grants, system state or execution authority.
- **Review rule:** candidate memories are not injected into normal retrieval. Owner acceptance is an explicit lifecycle transition.

## Immediate implementation sequence

1. Step 2.4: shared fail-closed PII/secret scrubber; apply at identified write/log/audit boundaries; add negative tests.
2. Step 2.5: server-derived untrusted provenance, schema allowlists, candidate-only memory writes, and owner review as the only acceptance path.
3. Step 2.6: isolated harmless canaries and alert-only tripwire tests.
4. Follow-on architecture spikes: typed RPC adapter, migration AST generator, ESCT protocol, FSM UI contract, signed Golden State Manifest, and supply-chain hash ledger.

## Non-goals and safety limits

- No client-side direct access to D1.
- No automatic production migration, deployment, merge or rollback.
- No automatic acceptance of model-generated or externally sourced memories.
- No biometrics or behavioral telemetry without a separately reviewed consent and privacy design.
- No claim of zero-latency, globally consistent or zero-knowledge behavior without measurements and a verifiable protocol.
