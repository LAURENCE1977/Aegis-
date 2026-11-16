# AEGIS durable agent orchestration

## Current scope

The first orchestration slice is a durable, plan-only workflow. It accepts a bounded objective and a small fixed list of specialist roles, persists the run, dispatches it through the existing runtime Queue, and stores a deterministic plan. It does not call an LLM, invoke tools, access files, browse, execute code or cause external effects.

## Flow

1. An authenticated runtime owner submits `POST /v1/agent-runs`.
2. The runtime validates the objective and specialist list, then persists an outbox row in D1 before attempting queue dispatch.
3. An optional `Idempotency-Key` prevents duplicate durable runs.
4. The existing `aegis-jobs` Queue consumer claims the run with an attempt-fenced lease and creates a deterministic specialist plan.
5. `GET /v1/agent-runs/:id` returns the durable status and plan.
6. Cron recovers expired leases and pending outbox rows. The existing dead-letter queue marks exhausted deliveries failed with an idempotent audit event.

## Specialists

Allowed roles are `researcher`, `planner`, `engineer`, `security` and `reviewer`. The default plan is researcher → engineer → reviewer. Roles are labels in a plan, not running agents or permissions.

## Safety and activation

- Every plan has `execution: plan-only`, no tools, no output and explicit human approval gates.
- No model provider, browser, shell, filesystem, MCP or external API is called.
- `AGENT_RUNS_ENABLED=true` is required before the agent-run API, queue processing or scheduled dispatch is enabled. This keeps existing runtime jobs unaffected until the owner deliberately enables the new table-backed feature.
- Apply `migrations/runtime/0002_agent_runs.sql` before setting the flag.
- The same existing runtime bearer token and Queue are reused; no second scheduler or worker is created.
- A future execution layer must call the trusted Sentinel composition root and use exact capability grants, connection metadata, encrypted secrets, approval consumption and append-only audit. It must not treat a specialist plan as authorization.

## Deployment status

This is source-level functionality only. The migration has not been applied to production D1, the runtime Worker has not been redeployed for this feature, and `AGENT_RUNS_ENABLED` has not been set.
