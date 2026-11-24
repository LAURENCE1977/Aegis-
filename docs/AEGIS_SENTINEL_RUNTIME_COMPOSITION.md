# AEGIS Sentinel runtime composition

**Status:** integration contract; not a deployed execution service.

## Trusted composition root

The only caller of `runSentinelInvocation` must be a server-side composition root. Browser clients, model output and agent prompts must never construct or inject the dependency object.

The composition root must:

1. Resolve the capability manifest from the trusted registry by ID and version.
2. Derive the canonical input digest server-side from the exact validated input. Never accept an agent- or browser-supplied digest as authoritative.
3. Load the current principal-scoped grant, provider connection and exact-operation approval from D1.
4. Resolve secrets only after Sentinel authorizes the invocation; never put plaintext credentials in the request, model context or audit record.
5. Persist redacted audit records before and after the adapter side effect.
6. Route only to a pinned, reviewed adapter with bounded input/output, explicit network egress and cancellation.
7. Atomically consume human-always approval immediately before execution.

## Fail-closed requirements

- Missing database bindings, unavailable audit, stale manifests, expired/revoked grants, mismatched resource/connection/input digest, or missing approval must stop execution.
- Adapter execution must not be reachable through a public generic endpoint.
- High-risk writes, external messages, destructive operations and device/computer control require explicit owner approval.
- A timeout or uncertain adapter result must not automatically replay a consumed approval.
- Every adapter response is untrusted input; redact secrets and bound its size before returning it to an agent.

## Runtime database boundary

The standalone runtime worker uses two distinct D1 bindings:

- `DB`: durable jobs, agent runs, device registry and runtime usage ledger; apply only `migrations/runtime` here.
- `CAPABILITY_DB`: Sentinel grants, provider connection metadata, approvals, invocation audit and invocation rate limits; apply only `migrations/capabilities` here.

The example worker configuration declares both bindings with placeholder database IDs. Creating either database, applying remote migrations, or setting production secrets is a separate owner-approved deployment step. Never alias the runtime `DB` to `CAPABILITY_DB` merely to make a missing binding appear configured.

The runtime's current agent queue remains plan-only. Declaring `CAPABILITY_DB` is infrastructure preparation, not permission to execute agent-proposed actions. A later execution slice must compose `createSentinelDependencies({ db: env.CAPABILITY_DB, adapters: createBuiltinAdapterRegistry() })` inside trusted server code, derive the principal from authenticated persisted ownership, and add an explicit, bounded action-request lifecycle with approval, cancellation, idempotency and audit tests before any adapter is reachable.

## Metadata-only capability proposals

The runtime now exposes `createAgentCapabilityProposal` as a first bridge contract between a persisted agent run and the trusted Sentinel registry. It accepts only the exact capability/action/resource/input shape and a separately supplied trusted run/principal context. It rejects wildcard or traversal resources, unknown or disabled capabilities, non-read actions and input that cannot be canonicalised within the manifest's byte limit.

A successful result contains the registry-derived capability version, required scopes, effect, risk and approval policy plus a server-derived SHA-256 input digest. It deliberately omits the raw input and is marked `status: proposed` and `execution: disabled`. It does not persist a proposal, load a grant, consume an approval, enqueue work, resolve a secret, call an adapter or execute an action. This keeps the current queue plan-only while establishing a typed, auditable hand-off contract for a later separately reviewed persistence and approval lifecycle.

## Cloudflare Pages API binding boundary

The Pages project needs two separate D1 bindings because its API routes serve both the runtime/device data model and the Sentinel policy store:

- `AEGIS_DB` remains the runtime/device database. It must point to the same D1 database ID as the standalone runtime Worker's `DB`, because pairing records, devices, agent runs and device assignments are shared.
- `CAPABILITY_DB` is the dedicated capability database. The Pages routes for grants, approvals, provider connections/secrets and Sentinel invocations use this binding. It must point to the same D1 database ID as the standalone runtime Worker's `CAPABILITY_DB`.

The two logical databases must remain separate: Pages `AEGIS_DB` / Worker `DB` are the runtime store; Pages `CAPABILITY_DB` / Worker `CAPABILITY_DB` are the policy and approval store. Do not point both Pages bindings at one database, and do not point either capability binding at the runtime database. The Pages project settings and worker example configuration must be reviewed together before deployment. No remote binding change, database creation or migration is authorized by this source change.


The runtime exposes this proposal lifecycle behind its existing bearer-token authentication:

- `POST /v1/agent-runs/:runId/capability-proposals` accepts the strict proposal request shape only after the durable run reaches `planned`.
- `GET /v1/agent-runs/:runId/capability-proposals` returns the persisted metadata for that run.
- The server derives the principal from the `AEGIS_PRINCIPAL_ID` runtime binding; callers cannot choose or override it.
- `migrations/runtime/0003_agent_capability_proposals.sql` creates an immutable, idempotently keyed proposal table and prevents updates/deletes at the database layer.
- Proposal creation and its redacted `capability_proposal_created` agent-run event are committed in one D1 batch. Repeating an identical request returns the existing proposal rather than creating a duplicate.

This lifecycle is still proposal-only. It intentionally does not create grants, approvals or adapter invocations, and the execution field is constrained to `disabled`. The runtime database migration must be applied before using these endpoints; the trusted `AEGIS_PRINCIPAL_ID` binding must be configured by the deployment owner. No production migration or configuration change is performed by this source change.

## Deployment gate

This document and the Sentinel library are source-level foundations only. Before enabling execution, add and test the D1 composition, digest helper, secret resolution, audit writer, adapter allowlist, SSRF/egress controls, revocation checks, idempotency and stop/revoke path. Apply migrations and provision production resources only after an explicit owner-approved deployment plan.


## Owner decision records for agent capability proposals

The runtime now supports a separate owner decision record for a persisted proposal:

- `POST /v1/agent-runs/:runId/capability-proposals/:proposalId/decision` accepts only `approved` or `rejected`, plus an optional reason capped at 500 characters.
- The runtime derives the principal from the trusted `AEGIS_PRINCIPAL_ID` binding and verifies that the proposal belongs to that principal and the requested run.
- `migrations/runtime/0004_agent_capability_proposal_decisions.sql` stores one immutable decision per proposal. Database triggers reject updates and deletes.
- Decision creation and its redacted agent-run audit event are committed together. A second decision attempt returns conflict rather than overwriting the first.
- Proposal listing includes the decision metadata when present.

**An approval is not an execution grant.** The response and proposal continue to report `execution: disabled`. This lifecycle does not create a Sentinel capability grant, consume a separate action approval, enqueue work, resolve secrets, call adapters or execute actions. Production migration and binding changes remain outside this source-only change.
