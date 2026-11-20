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


## Outcome-first planning — first durable slice

The plan submission now optionally accepts:
- up to eight explicit acceptance criteria (each 1–240 characters);
- one planning priority: `balanced`, `lowest_cost`, `fastest` or `highest_reliability`.

The existing JSON column stores a version-tolerant envelope containing specialist roles, criteria and priority. Readers continue to accept legacy rows where the column contains only the original specialist array; no D1 migration is required for this extension.

Every generated plan preserves the acceptance criteria and includes a verification contract requiring evidence before completion can be claimed. It also compares three bounded, non-executable approaches:
- **Lean first pass:** minimise initial scope and effort.
- **Parallel discovery:** shorten elapsed time where work is independent, with coordination/cost trade-offs.
- **Staged assurance:** sequence evidence, implementation and review for stronger reliability.

The priority selects a recommended approach but does not remove the alternatives. These are deterministic planning templates, not claims of live agent collaboration, parallel execution, cost estimation or autonomous tool selection. All remain `plan-only`, carry no tools and create no external effects.

The next evolution is to enrich these proposals using verified capability metadata and evidence-backed cost/latency/reliability estimates, then render the outcome, alternatives, checkpoints and acceptance criteria in the adaptive workspace. Any execution remains a separate Sentinel-governed stage.

## External repository research and adoption decisions

Research references:
- [OpnForm](https://github.com/OpnForm/OpnForm): conversation-to-form drafts, private preview and MCP. Candidate for structured requirements and user-reviewed form creation. Its repository declares AGPL-3.0; any code reuse needs a separate licence/hosting assessment. Prefer a replaceable MCP adapter over importing its application.
- [Morphic](https://github.com/miurla/morphic): cited research, quick/adaptive modes, multi-provider search and streamed generative UI. Candidate patterns for evidence-first research and task-specific result presentation. Its repository declares Apache-2.0; preserve notices and review dependencies before reuse.
- [Open-Morphic](https://github.com/engkimo/open-morphic): layered orchestration, semantic/context memory, model/engine routing, task handoff and execution learning. Candidate patterns for orchestration and measured recovery. Its repository declares MIT; architecture and security claims still require independent verification.

No source code, dependencies, hosted services or credentials from these projects have been imported or connected. Their outputs are reference material only. AEGIS retains its own workspace, provider-neutral interfaces and Sentinel governance model.
