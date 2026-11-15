# AEGIS Agent Orchestration — durable plan-only foundation

## Status

The first durable orchestration slice is implemented on `feature/durable-agent-orchestrator`. It is a plan-only workflow, not autonomous tool execution. It reuses the existing AEGIS Runtime Worker, D1 database and Queue; it does not add a competing scheduler or execution host.

## Flow

1. An authenticated owner submits a bounded objective and an optional list of specialist roles to `POST /v1/agent-runs`.
2. The runtime validates the exact request shape, writes the run as `pending_dispatch`, and only then publishes `{ agentRunId }` to the existing Queue.
3. The Queue consumer atomically claims the run with an incremented attempt number and a two-minute lease.
4. The orchestrator creates a deterministic plan with ordered specialist steps and stores the plan in D1.
5. The owner reads the durable state and plan through `GET /v1/agent-runs/:id`.
6. The existing once-per-minute Cron sweep recovers expired leases and pending outbox rows.

States:

`pending_dispatch → queued → running → planned`

A failed plan attempt is retried with bounded exponential delay and attempt fencing. After the maximum attempt count, the run becomes `failed`. Queue delivery remains at-least-once.

## Specialist roles

The initial fixed role catalogue is:

- `researcher` — gather evidence and source provenance.
- `planner` — sequence bounded work and define acceptance criteria.
- `engineer` — propose implementation tasks and tests.
- `security` — identify trust boundaries and approval requirements.
- `reviewer` — independently assess the proposed result.

The caller cannot define new roles, tools, permissions, prompts, arbitrary URLs or executable payloads. The default sequence is researcher → engineer → reviewer; selected roles are normalized into the canonical order.

## API

All endpoints use the existing private runtime bearer token. Keep it in an encrypted Worker secret; never put it in browser code, source control or chat.

Submit:

```http
POST /v1/agent-runs
Authorization: Bearer <AEGIS_JOB_TOKEN>
Content-Type: application/json
Idempotency-Key: optional-8-to-128-safe-characters

{
  "objective": "Review the AEGIS runtime",
  "specialists": ["researcher", "engineer", "reviewer"]
}
```

- `objective`: required text, trimmed, 1–2,000 characters.
- `specialists`: optional, 1–5 unique roles from the fixed catalogue.
- Unknown fields are rejected.
- The request body uses the runtime's existing 8 KiB cap.
- The response is `201` when queued or `202` while awaiting outbox recovery.

Read:

```http
GET /v1/agent-runs/<uuid>
Authorization: Bearer <AEGIS_JOB_TOKEN>
```

The response includes objective, selected roles, status, attempts, timestamps, plan and stable error code. It excludes raw database fields and secrets.

## Security boundary

- This slice creates plans only. It does not call a model, invoke a capability, run shell/code, fetch URLs, control a browser or perform external writes.
- Each planned step has an empty tool list. The plan explicitly records `toolsInvoked: false` and `externalEffects: false`.
- Any future step execution MUST resolve the exact registered capability/action and pass through the single server-side Sentinel gate, current grant/connection checks, exact-operation approval consumption where required, and durable redacted audit.
- An agent role, plan entry, MCP catalogue record or manifest declaration is never a permission grant.
- Human approval remains mandatory for protected, destructive, production-impacting, costly or externally consequential operations.
- Retrieved objectives and future research outputs are untrusted data, never instructions that can override policy.

## Storage and deployment

Migration: `migrations/runtime/0002_agent_runs.sql`. Apply it after `0001_jobs.sql` to the same runtime D1 database. It creates `agent_runs` and append-only-by-convention event history `agent_run_events`, with status/lease indexes and unique idempotency keys.

The implementation reuses the existing `JOBS` Queue and runtime Worker. No additional Cloudflare resource, paid service, secret, binding or deployment was created. The existing runtime Worker must be deployed with the updated source and migration applied before the endpoints can be used.

## Verification

Focused tests are in:

- `tests/agent-orchestrator.test.mjs` — bounded request validation and deterministic plans.
- `tests/agent-runtime.test.mjs` — persistence-before-dispatch, idempotency, strict input rejection, plan-only Queue processing, status retrieval and outbox recovery.

Run the repository's documented full suite with Node.js 22:

```sh
node --test tests/*.test.mjs
```

A passing local/CI run and a non-production D1/Queue integration check are required before treating this as operational. Production runtime deployment and D1 migration application remain separate owner-approved steps.
