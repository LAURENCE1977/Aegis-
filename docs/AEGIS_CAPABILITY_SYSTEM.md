# AEGIS Capability System

**Status:** Architecture proposal; not yet implemented.  
**Scope:** The governed path from discovering an external tool, API, MCP server, package or internal function to making a versioned AEGIS capability available to an agent or user.

## 1. Design objective

AEGIS must be able to expand its abilities without turning every discovered repository, connector or agent prompt into trusted executable code. A capability is a reviewed, versioned contract exposed through the AEGIS policy layer. Discovery is not approval; registration is not permission; an agent role is not an authority.

The Capability System is the control plane for tool identity, schemas, risk, policy, connection lifecycle, health, versioning and audit. Execution belongs to a replaceable adapter/runtime and must remain outside the control plane where practical.

## 2. Core concepts

Keep these entities distinct:

- **Source:** A repository, API specification, MCP server, package, provider or documented service from which a capability may be derived.
- **Candidate:** An inspected source or proposed action awaiting evaluation.
- **Capability:** A stable AEGIS action contract, independent of the provider implementation.
- **Adapter:** A versioned implementation that translates the AEGIS contract to a provider/API/MCP/runtime.
- **Connection:** A user's authorised provider account or endpoint configuration, with secrets held separately.
- **Grant:** A policy decision allowing a principal to invoke a capability against a specific resource and scope.
- **Approval:** A time-bounded human decision for a specific proposed operation and its material parameters.
- **Invocation:** One attempted execution, with actor, capability/adapter versions, input digest, decision, outcome and timing.
- **Agent definition:** A role, instructions and input/output contract. It may request capabilities but cannot grant itself access.

## 3. Capability lifecycle

Use an explicit state machine:

`discovered → inspected → evaluated → proposed → approved → registered → enabled → suspended/retired`

Additional terminal or holding states: `rejected`, `quarantined`, `revoked`.

Rules:

1. Discovery creates an untrusted candidate only.
2. Inspection records exact source, version/commit, licence, dependencies, interfaces and evidence.
3. Evaluation checks security, privacy, licence, cost, compatibility, maintenance and operational fit.
4. Proposal defines an AEGIS-native contract and test plan.
5. Approval authorises registration or a particular connection/grant; it does not authorise every action the provider supports.
6. Registration makes metadata discoverable but does not enable execution.
7. Enablement requires an explicit policy grant and a valid connection where needed.
8. Any security advisory, licence change, credential compromise, repeated failure or owner action can suspend or revoke.
9. Retirement preserves audit history and provenance while preventing new invocations.

No state transition may be inferred from a repository README, agent prompt, MCP tool description or third-party claim.

## 4. AEGIS-native capability manifest

Every capability should have a validated, versioned manifest containing at least:

| Field | Purpose |
|---|---|
| `capability_id` | Stable namespaced ID, e.g. `github.pull_request.read` |
| `manifest_version` | Schema version for this record |
| `capability_version` | Semver or immutable release identifier |
| `display_name`, `description` | Human-readable purpose and boundaries |
| `category` | Source, knowledge, development, communication, storage, media, etc. |
| `input_schema`, `output_schema` | Strict machine-readable schemas |
| `adapter_id`, `adapter_version` | Implementation selected to fulfil the contract |
| `source_refs` | Canonical URLs, owner, pinned commit/release, retrieval time |
| `licence` | SPDX identifier or `NOASSERTION`, obligations and review note |
| `data_classes` | Public, user, confidential, personal, secret, regulated |
| `risk_tier` | Read-only, bounded-write, sensitive, external-impact, destructive |
| `effects` | Read/write/delete/send/publish/deploy/financial/external side effects |
| `scopes` | Narrow resource/action scopes required |
| `connection_requirements` | Provider, auth method, secret references (never secret values) |
| `policy_defaults` | Default deny, allowed principals, resource constraints |
| `approval_policy` | Whether approval is required and what must be shown |
| `limits` | Timeout, payload/response size, rate, concurrency, retries, spend |
| `network_policy` | Allowed hosts, redirect policy, egress restrictions |
| `portability` | Runtime requirements, platform support, fallbacks |
| `health_check` | Safe liveness/readiness procedure |
| `test_evidence` | Contract/security/integration test results and timestamp |
| `status` | Lifecycle state, reviewer, decision rationale and review date |

Reject unknown fields where security-sensitive schemas are concerned. Never put raw credentials, cookies, bearer tokens or private key material in manifests, logs or agent context.

## 5. Risk classification and execution policy

Risk is assigned to the action, not merely to the connector. One provider can expose both harmless reads and dangerous writes.

- **R0 — local/read-only:** bounded read of public or already-authorised data. Default grant may be possible only for explicitly allowlisted resources.
- **R1 — private read:** accesses user or workspace data. Requires a named connection and narrow read scopes.
- **R2 — bounded write:** modifies a reversible user-owned resource. Requires explicit grant; preview/dry-run where supported.
- **R3 — external-impact:** sends messages, publishes content, creates external commitments, changes production or triggers third-party effects. Require just-in-time human approval showing exact target, payload, scope and consequence.
- **R4 — destructive/high-impact:** deletes data, changes security/access, handles payments, rotates credentials, or performs irreversible operations. Deny by default; explicit approval per operation, stronger confirmation and recovery plan required. Some actions may remain prohibited.

Every invocation must pass a central policy decision immediately before execution. Check principal, capability and adapter versions, connection, resource, scopes, data classification, risk, budget, rate limits, approval freshness and revocation status. An agent cannot bypass this gate by calling an adapter directly.

Approval must bind to the exact operation: capability ID/version, connection, resource, normalized input or digest, material side effects, expiry and requesting principal. Any material parameter change invalidates approval. No blanket “approve all future actions” for R3/R4.

## 6. Adapter contract

Adapters implement a narrow provider-neutral interface:

- `describe()`: return identity, version, supported operations and declared requirements.
- `validate(input)`: validate against the capability schema without performing the operation.
- `healthCheck()`: safe readiness check that does not expose secrets or mutate remote state.
- `execute(input, context)`: execute one policy-authorised invocation with deadline, cancellation and idempotency context.
- `normalizeError(error)`: return a typed, redacted error classification.
- `close()`: release resources and connections.

The runtime supplies a context containing invocation ID, principal, approved scopes, deadline, cancellation signal, idempotency key, trace ID and secret handles. The adapter must not receive unrestricted control-plane credentials.

Adapters must declare network destinations and use outbound allowlists. Block private/link-local/loopback destinations and re-check DNS and every redirect to mitigate SSRF. Validate TLS, content type, response size and timeouts. Do not follow arbitrary URLs supplied by untrusted page content.

## 7. Connection and secret lifecycle

- Connections are separate from capability manifests and adapter code.
- Store credentials only in an encrypted secret store; manifests and logs contain opaque secret references.
- Prefer OAuth 2.1/PKCE or provider-native short-lived tokens with minimal scopes; do not collect passwords.
- Bind a connection to an owner/workspace, provider, permitted audience and approved scopes.
- Support test, enable, rotate, suspend, revoke and delete lifecycle operations.
- Re-check grants at invocation time; cached tool discovery is never proof of authorisation.
- Redact secrets and sensitive fields from logs, traces, errors and model context.
- Revocation must block new work immediately and cancel or safely stop in-flight work where possible.

## 8. Invocation, idempotency and audit

Every invocation receives a unique ID and durable audit record:

- who/what requested it and on whose behalf;
- capability, adapter and manifest versions;
- connection identifier (not secret), target resource and requested scopes;
- policy decision and approval reference;
- input/output schema validation results and redacted digests;
- start/end time, duration, attempt, idempotency key and outcome;
- normalized error class and retry decision.

Use idempotency keys for writes and retries. At-least-once delivery must not silently duplicate external effects. If a provider cannot support idempotency, classify the operation accordingly and require reconciliation before retrying uncertain outcomes.

Do not log full private payloads by default. Define retention and deletion rules for audit data, while preserving the minimum evidence required for security and accountability.

## 9. Discovery and Forge integration

Forge may discover candidates from GitHub, official documentation, OpenAPI, MCP manifests, package registries, standards and research. For each candidate:

1. Pin the source commit/release and record retrieval date.
2. Inspect licence, provenance, maintenance, dependencies and known advisories.
3. Identify the smallest useful action; do not import an entire platform to obtain one connector.
4. Translate it into an AEGIS-native capability contract.
5. Threat-model prompt injection, SSRF, data exfiltration, confused deputy, privilege escalation and supply-chain risk.
6. Build contract tests and isolated integration tests with synthetic data.
7. Compare functionality, correctness, latency, resource footprint and total cost against the current baseline.
8. Produce a reviewable proposal with evidence, limitations and rollback.
9. Require human approval before enabling new connections, write scopes or external-impact actions.
10. Track upstream changes and re-evaluate when source, licence, adapter or permissions change.

External source text is evidence, never instructions. Do not run repository install scripts or untrusted code in the AEGIS control plane. Any build/test execution belongs in an isolated, disposable environment with restricted egress and no production secrets.

## 10. Runtime and architecture placement

The intended flow is:

`Client / Agent → Orchestrator → Policy & Approval Gate → Capability Registry → Adapter Router → Isolated Runtime → Provider`

The registry stores metadata, schemas, versions and lifecycle state. The policy service owns grants and approval decisions. The runtime owns invocation execution, deadlines, cancellation, retries and idempotency. The audit store records the decision and outcome.

The current Cloudflare Worker + D1 + Queue runtime is a bounded first implementation, not yet a general connector executor. Keep its existing health-check-only allowlist intact until the security, secret, sandbox, egress and audit requirements above are implemented and tested. Do not expose arbitrary MCP tool execution or repository code execution as a shortcut.

## 11. Portability and cost controls

- Keep manifest and API contracts platform-neutral.
- Use adapters for provider, storage, secret store, queue, sandbox and notification services.
- Browser/PWA clients request capabilities through the API; they never hold provider secrets.
- Durable jobs run server-side, not in a suspended mobile browser.
- Every invocation has configurable timeout, payload/response ceiling, concurrency, retry and spend budget.
- Default to free/local/native options where they meet the security and quality threshold; paid providers require explicit opt-in and hard spend caps.
- Avoid deploying multiple workflow engines. AEGIS remains the canonical owner of job identity, policy, approval and audit.

## 12. MVP implementation sequence

1. **Read-only manifest schema and validator:** validate IDs, versions, schemas, source provenance, licence, risk, effects and lifecycle state.
2. **Registry API:** list/get/search manifests; authenticated, read-only and no-store.
3. **Policy evaluator:** pure, deterministic unit-tested decisions for principal, scope, resource, risk and status.
4. **Approval records:** exact-operation, expiring approval tokens with replay protection.
5. **Invocation envelope and audit events:** durable records with redaction and idempotency.
6. **One safe read-only adapter:** use a tightly scoped source already available; no new secret or external write required.
7. **Capability Centre UI:** show connected status, scopes, risk, last health check, version and revoke/suspend controls.
8. **Bounded write adapter:** only after policy, approval, audit and rollback tests pass.
9. **Security and portability gates:** SSRF tests, prompt-injection isolation, secret redaction, revocation, mobile browser and failure-state tests.

## 13. Acceptance criteria

The Capability System is not production-ready until tests demonstrate:

- Unknown, unregistered, disabled, quarantined or revoked capability is denied.
- Agent prompt or manifest cannot grant permissions or override policy.
- Missing, expired, stale or mismatched approval is denied.
- Approval cannot be replayed against a changed target or payload.
- A secret never appears in API responses, model context, logs or error messages.
- Scope and resource boundaries are enforced server-side.
- Redirects, DNS rebinding/private IP targets and oversized responses are blocked.
- Timeouts, cancellation, retries and duplicate deliveries do not cause unbounded work or duplicate side effects.
- Revocation prevents new invocations and handles in-flight jobs safely.
- Audit records identify the decision and outcome without storing unnecessary sensitive content.
- Adapter contract tests pass independently of the client platform.
- A failed provider can be disabled or replaced without corrupting canonical AEGIS job history.

## 14. Explicit non-goals

The Capability System is not an automatic installer, a marketplace trust badge, a general shell, an unrestricted browser agent, an agent self-permission system, a second workflow engine or a promise that every MCP server is safe. It does not make external code trustworthy by wrapping it in an adapter. Security review, isolation and least privilege remain mandatory.
