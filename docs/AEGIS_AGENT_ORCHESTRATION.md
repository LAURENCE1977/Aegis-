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


## Sentinel-gated capability bridge — server-side only

`workers/runtime/agent-capability-bridge.mjs` exposes a trusted server-side bridge for future agent capability calls. It accepts only capability ID, action ID, resource ID and JSON input; principal identity and all policy dependencies come from trusted server composition code. It resolves the manifest from the canonical registry, validates the exact action, normalizes and bounds the JSON payload, computes its digest with the shared `canonical-input.mjs` helper, and deeply freezes the normalized value before Sentinel receives it. Sentinel then applies current grant/connection policy, exact approval loading and atomic consumption, and durable redacted audit.

The bridge is not called by the plan-only agent Queue and is not exposed as a public route. The runtime still creates plans only. The shared digest helper and the D1 composition root independently verify the same exact payload before a fixed adapter handler can run. Any future adapter must be explicitly registered server-side and pass the Sentinel gate; agent role names and plan steps are never permissions.


## Objective-relevant Project Space knowledge context

When an owner submits a plan-only agent run with a Project Space, AEGIS now passes the run objective into the Project Space context builder. The builder retrieves up to 100 owner-scoped accepted Forge records, filters to high/medium evidence with attributable sources, and uses the native deterministic BM25 ranker to select up to five records relevant to the objective. If no record matches, it falls back to a bounded recent accepted subset so existing project context is not silently lost.

The attached records include source attribution, limitations, evidence level, version and update time. They are labelled `untrusted-reference`, included within the existing 4 KiB knowledge / 12 KiB overall context budgets, and covered by a canonical digest. Draft, reviewed, superseded, low/experimental evidence and other-owner records are excluded. Retrieved knowledge remains reference material, never instructions, permission or authoritative task state.

This is context assembly only: the runtime still creates plans, not autonomous specialist execution. It does not call an external vector database, model evaluator or retrieval service.


## Persisted task-envelope boundary — 18 November 2026

The plan-only queue now creates one canonical `aegis.agent-task-envelope/1.0` for each specialist step and persists it in `agent_run_steps.task_json`. The envelope binds run ID, step ID, specialist, attempt, objective, context digest, bounded output/time budgets and the fixed plan-only execution mode. Capability requests are always empty.

Migration `0009_agent_step_task_envelopes.sql` enforces valid JSON, schema version, plan-only mode, empty capability requests and exact row binding for run ID, step ID and specialist. Once populated, `task_json` is immutable. When runtime APIs read step records, they validate the stored envelope and verify it matches the parent run and step.

This is task-contract persistence only. It does not start execution, call a model, invoke tools, grant capabilities or create an execution receipt. The real Miniflare/D1/Queue integration test applies the new migration, processes a real local Queue message, checks persisted task envelopes, and verifies D1 rejects altered task definitions, unsafe execution modes and cross-run task identities.

Latest verified code head `38f76f10ebec8804f058db1d352aa259e5944bee`: push workflow [44350473762](https://github.com/LAURENCE1977/Aegis-/actions/runs/44350473762) and matching PR workflow [44350489254](https://github.com/LAURENCE1977/Aegis-/actions/runs/44350489254) passed all 24 steps; Node.js suite **966 tests, 965 passed, 0 failed, 1 skipped**. PR #103 remains open/draft/unmerged; no production deployment.
