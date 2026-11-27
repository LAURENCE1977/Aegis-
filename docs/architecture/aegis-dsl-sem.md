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


## Genesis Directive v3.0 — Living Organism operating model

The biological analogy is an architectural teaching model, not a claim that AEGIS is conscious or biologically alive. AEGIS is treated as an evolving digital organism: interactions are sensory inputs; provenance and trust labels are its immune recognition; policy and capability checks are its protective barriers; observability is its nervous system; and reviewed, tested releases are its controlled adaptation.

### Organism lifecycle

1. **Sense:** collect only necessary events from approved interfaces and integrations.
2. **Classify:** label source, provenance, sensitivity, confidence and trust level.
3. **Contain:** isolate suspicious input and deny authority to untrusted content.
4. **Reason:** analyse evidence within bounded agent capabilities.
5. **Propose:** prepare a patch, configuration change or learning candidate without applying it.
6. **Verify:** run tests, policy checks, security scans and isolated simulations.
7. **Approve:** require owner approval for privileged or production-impacting changes.
8. **Release and observe:** deploy through a versioned pipeline, monitor health and retain a tested rollback path.

### Evolution and self-healing safety boundary

AEGIS may autonomously detect anomalies, create incident records, quarantine bounded data, draft patches, run isolated tests and recommend rollback. It must not autonomously rewrite its own executable code, mutate production configuration, grant capabilities, alter security policy, deploy a patch or spend funds.

Runtime `eval` / `new Function`, self-modifying Worker code, live route/token-schema mutation and unreviewed WebAssembly hot-swapping are prohibited design patterns for the trusted control plane. Defensive updates must be ordinary reviewed source changes, built reproducibly and released through the approved CI/CD pipeline. A canary alert may trigger a bounded containment workflow; it must not become an unrestricted self-patching loop.

### Additional frontier concepts — staged research register

| Concept | Safe engineering interpretation | Gate |
|---|---|---|
| Self-mutating edge workers | Generate a proposed patch in a separate workspace; test and review it; deploy as a normal immutable version | No runtime code mutation |
| Autonomous immunity loop | Detect, classify, alert, quarantine within pre-authorized bounds, draft remediation and request approval | No autonomous production code or policy writes |
| Metabolic cleanup | Scheduled, observable maintenance proposals; index changes measured against representative workloads and applied as reviewed migrations | No destructive autonomous schema/index changes |
| Polymorphic code mutation | Prefer conventional hardening, secret rotation and versioned deployment; do not mutate public interfaces or token formats unpredictably | No daily route/token mutation |
| Temporal hash / causal audit DAG | Append-only events linked to parent digests, signed checkpoints and externally retained verification anchors | Cryptographic review and key-management design |
| Neuromorphic threat topology | Evidence-backed graph of related indicators and bounded risk propagation, with explainable scoring | No autonomous global lockdown from weak signals |
| IFC / SSA taint tracking | Explicit source-to-sink labels, typed wrappers and static analysis where language/tooling supports it | Incremental coverage and false-negative testing |
| ESCT capability tokens | Single-use, audience- and action-bound tokens, maximum 30-second lifetime, replay protection and D1 grant validation | Separate protocol design and security review |
| Behavioral Sentinel | Optional privacy-minimising signals with explicit consent, retention limits and non-biometric alternatives | Privacy/legal assessment before collection |
| Golden State Manifest | Signed manifest of approved configuration/schema hashes, drift alerts and owner-approved restoration | Never overwrite evidence or rollback autonomously |
| Canary / Turing-Hedge | Isolated synthetic decoy resources with harmless markers, telemetry and alert-only initial response | No real secrets; no interaction with production data |
| Supply-chain ledger | Reproducible build metadata and SHA-256/Sigstore-style attestations for reviewed source, migrations and configuration | Verify keys, provenance and CI enforcement |
| FSM-first Eve UI | Server-authoritative finite-state transitions with explicit invalid-transition handling; render state from validated events | UI cannot set threat state or security policy |
| Metabolic UI morphing | Accessible, deterministic layout modes driven by explicit incident states and user preferences | No hidden inference of cognitive/biological state |
| Algorithmic speciation | Offline/shadow evaluation against fixed datasets; champion/challenger comparison and human-reviewed promotion | Never learn directly from untrusted live traffic into production |
| Teleological intent generation | Propose measurable reliability/security goals with explicit constraints and owner selection | No self-selected authority or unbounded objectives |
| Autonomous treasury | Budgeted recommendations and transaction drafts | Human approval for every transfer or financial commitment |
| Mycelial knowledge graph | Provenance-bearing graph of facts, sources, confidence, lifecycle and explicit relationships | Untrusted nodes never become trusted instructions |
| Planetary mesh | Multi-region resilience and portable deployment architecture using supported cryptography and infrastructure | No self-replication or uncontrolled resource creation |

### Security and reliability claims

- “Zero lag”, “sub-millisecond global consistency”, “quantum-entangled”, “zero-knowledge” and “absolute zero-trust integrity” are aspirations, not accepted implementation claims. Each requires a precise protocol, threat model, measurable service objective and independent verification.
- D1 is durable edge-accessible storage, not a globally linearizable, sub-millisecond shared memory bus. Session consistency and latency must be measured against the actual Cloudflare topology and service guarantees.
- Quantum-resistant cryptography means adopting standardised, supported post-quantum algorithms and migration plans—not describing ordinary hashes as quantum entanglement.
- Security events can request a state transition, but only server-side policy may authorize it. The client and Eve avatar are presentation surfaces, never sources of authority.
- Financial, privacy-sensitive, destructive and production-impacting actions remain owner-governed.

## Genesis Directive v3.0 execution gates

**Immediate:** complete Phase 2 Steps 2.4 and 2.5 on `feature/production-migrations`; run focused and full Node tests and GitHub Actions; preserve production isolation.

**Next:** Step 2.6 isolated canary tripwires, initially alert-only.

**Later architecture spikes:** typed RPC compatibility layer; declarative schema/AST migration generator that emits reviewable SQL; broader IFC/taint analysis; ESCT protocol; signed Golden State Manifest; cryptographic supply-chain ledger; deterministic FSM UI contract.

**Deferred research:** autonomous code evolution, polymorphic runtime mutation, neuromorphic global threat propagation, algorithmic speciation, autonomous financial treasury and planetary self-replicating infrastructure. These are not part of the trusted production control plane.
