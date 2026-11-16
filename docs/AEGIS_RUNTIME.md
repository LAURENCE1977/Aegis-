# AEGIS Runtime — first durable job slice

## Status

The first independent Cloudflare Worker runtime is implemented in source and covered by Node.js tests. It is **not deployed or connected to production yet**. It requires a D1 database, a Queue, an encrypted `AEGIS_JOB_TOKEN` secret and a separate Worker deployment.

The initial allowlist contains exactly one harmless task: `aegis.health_check`. No shell, code execution, arbitrary URL fetch, repository execution, deployment or external write tasks are accepted.

## Architecture

- **Worker API:** authenticated `POST /v1/jobs`, `GET /v1/jobs/:id` and `GET /health`.
- **D1:** durable job records and append-only job event records.
- **Queue:** asynchronous delivery to the Worker consumer.
- **Outbox recovery:** jobs are first committed as `pending_dispatch`; a once-per-minute Cron sweep retries dispatch if the request died between the D1 write and Queue send.
- **Lease recovery:** a two-minute lease lets Cron recover a consumer that died after claiming a job.
- **Attempt fencing:** the claim atomically returns its own incremented attempt number (`UPDATE ... RETURNING attempts`); completion/retry updates are conditional on that captured value. A stale worker cannot adopt a newer consumer's attempt after lease recovery.
- **Idempotency:** optional `Idempotency-Key` prevents duplicate job creation for the same request key.
- **Dead-letter queue:** the consumer config routes repeatedly undeliverable messages to `aegis-jobs-dlq`.

The job states are:

`pending_dispatch → queued → running → succeeded | failed`

A retry returns a running job to `queued`. An expired running lease is returned to `pending_dispatch` so the outbox sweep can re-enqueue it.

Agent runs currently create a plan only; they do not execute specialist work. The owner Pages API accepts an optional `projectId`, loads only that active owner-owned Project Space, and builds a bounded handover brief from project event summaries and accepted, non-restricted, non-expired project memories. The browser cannot submit its own `projectContext`. The Pages API passes the derived brief and a stable content digest to the private runtime; the runtime validates the schema, recomputes the digest, persists the snapshot in `agent_runs.context_json`, and binds the digest and context counts into the plan. The brief's generation timestamp is excluded from the digest so idempotent retries remain stable; changes to project content produce a different digest and a `409` on idempotency-key reuse. Event and memory text is always marked as untrusted reference data, never instructions or permissions. Each plan step is materialised as a durable `agent_run_steps` record with a stable run-scoped ID, ordered index, specialist, immutable plan-step snapshot, status, attempt count and checkpoint/result slots. A corresponding append-only `agent_run_step_events` record tracks the planned transition. Plan completion and step materialisation are committed in one D1 batch; a cancelled or stale worker cannot create step records. These rows are a durable checkpoint foundation only: every step remains `planned` until a separately implemented, approved executor is available. The owner can cancel an agent run with `POST /v1/agent-runs/{id}/cancel`. Cancellation is stored in `cancelled_at` and exposed as the terminal API status `cancelled`, preserving the existing constrained status enum and event foreign keys. Pending dispatch, queued, running and planned runs can be cancelled; failed runs cannot. Claims, plan completion, retries and outbox dispatch all check the cancellation marker, so a queue delivery racing with cancellation is acknowledged without planning or retrying. Repeating cancellation is idempotent and the append-only event is written once.

## Dead-letter recovery

The runtime now distinguishes the primary `aegis-jobs` queue from `aegis-jobs-dlq` using the Cloudflare `MessageBatch.queue` value. Exhausted deliveries conditionally fail only queued/pending jobs or running jobs whose lease has expired, set `JOB_DELIVERY_EXHAUSTED`, clear the lease and append a deterministic, idempotent `delivery_exhausted` audit event. Active leases and terminal jobs are preserved. Unknown queue batches are acknowledged without executing their payloads.

The Wrangler example registers the dedicated DLQ consumer. This is source/configuration only: no Cloudflare D1 database, Queue or runtime Worker has been provisioned or deployed. The regression tests use an in-memory D1/Queue adapter and are not a substitute for live Cloudflare integration tests.

## API contract

All endpoints require:

`Authorization: Bearer <AEGIS_JOB_TOKEN>`

The secret must be at least 32 characters and must be stored as an encrypted Worker secret. Never put it in source control, browser code, URLs, screenshots, logs or ChatGPT messages.

### Submit the initial safe job

```http
POST /v1/jobs
Content-Type: application/json
Authorization: Bearer <token>
Idempotency-Key: health-check-0001

{
  "type": "aegis.health_check",
  "payload": {}
}
```

The API validates a strict task allowlist, persists the job, and then publishes a queue message. If queue publication fails, the persisted job remains `pending_dispatch` and Cron retries it. The response is `201` when queued or `202` when awaiting dispatch recovery.

### Read job status

```http
GET /v1/jobs/<uuid>
Authorization: Bearer <token>
```

The response includes state, attempts, timestamps, result and a stable error code. It does not return secrets or internal exception messages.

### List recent agent runs

```http
GET /v1/agent-runs?limit=20
Authorization: Bearer <token>
```

The owner-only history endpoint returns at most 50 runs per page, newest first. It uses a stable keyset cursor so runs sharing the same timestamp are not skipped or duplicated:

```http
GET /v1/agent-runs?limit=20&before=<createdAt>&beforeId=<uuid>
Authorization: Bearer <token>
```

The response contains `runs` and either a `nextCursor` object or `null`. Unknown query parameters, repeated parameters, invalid timestamps and incomplete cursors are rejected.

### Read an agent run's event timeline

```http
GET /v1/agent-runs/<uuid>/events?limit=20
Authorization: Bearer <token>
```

The event timeline returns bounded, newest-first lifecycle events. It uses a stable cursor over `created_at DESC, event_id DESC`, so events written at the same timestamp remain correctly ordered across pages. Event detail is parsed as JSON and malformed or oversized detail is returned as an empty object rather than raw text.

```http
GET /v1/agent-runs/<uuid>/events?limit=20&before=<createdAt>&beforeId=<eventId>
Authorization: Bearer <token>
```

The API first verifies the parent run exists. It rejects unknown or repeated query parameters, incomplete cursors, invalid timestamps and unsafe event IDs. Each page contains at most 50 events.

### Submit, inspect and cancel an agent run

Agent runs currently create a deterministic plan only; they do not invoke models, specialist workers or external tools.

```http
POST /v1/agent-runs
Content-Type: application/json
Authorization: Bearer <token>
Idempotency-Key: review-runtime-0001

{
  "objective": "Review the AEGIS runtime for reliability gaps",
  "specialists": ["researcher", "engineer", "security", "reviewer"]
}
```

The specialist list is optional and is limited to the server-defined roles: researcher, planner, engineer, security and reviewer. The default is researcher, engineer and reviewer. The response contains the durable run ID and current state. The submission endpoint enforces its 8 KiB request-body limit while streaming the request, so absent or dishonest `Content-Length` headers cannot cause an unbounded body to be buffered; oversized streams are cancelled and rejected with `413` before JSON parsing or persistence.

```http
GET /v1/agent-runs/<uuid>
Authorization: Bearer <token>
```

The detail response includes the ordered durable step records, each with its specialist, status, attempt count, plan-step snapshot, checkpoint, result and stable error code. This is inspection only; the records remain `planned` until an approved step executor is implemented.

```http
POST /v1/agent-runs/<uuid>/cancel
Authorization: Bearer <token>
```

Cancellation is idempotent. The API returns the run with status `cancelled` and its durable step records. In the same D1 batch it fences the run, marks all non-terminal step records `cancelled`, and appends one deterministic cancellation event per step. A worker or queue delivery that races with cancellation cannot persist a plan or schedule a retry. Failed runs return `409` because they are already terminal.

### Request and decide future execution approval

The owner-only Pages API can create a pending approval for an existing `planned` run and list the pending agent-run approvals:

```http
POST /api/sentinel/agent-run-approval
Content-Type: application/json

{ "runId": "<uuid>" }
```

```http
GET /api/sentinel/agent-run-approval
```

A separate same-origin owner decision records an explicit approval or denial:

```http
PATCH /api/sentinel/agent-run-approval/<approvalId>
Content-Type: application/json

{ "decision": "approved" }
```

The owner must first create an active exact-resource grant for `agent-run:<runId>` with the capability's `aegis:agent-run:execute` scope. Agent Workforce has a **Prepare exact execution grant** control that fills the owner grant form; the owner still reviews and creates the grant explicitly. The owner can then consume that exact approved record and ask the runtime to persist a one-time authorisation:

```http
POST /api/sentinel/agent-run-approval/<approvalId>/authorize
Content-Type: application/json

{}
```

These Pages routes require the normal AEGIS owner session and the `AEGIS_DB` capability database binding. The server fetches the persisted plan itself; clients cannot submit a digest, capability, resource, scope or operation summary. The approval binds the complete canonical plan digest, exact run ID, registered critical capability/action and owner principal, and expires after 15 minutes. Decisions are atomically restricted to the owner and the `aegis-agent-run` capability. Sentinel reloads the approved record by exact ID, fetches the plan again, recomputes the binding, verifies an active grant for the exact run resource and every manifest-required scope, and atomically consumes the approval before calling the private runtime route. The runtime persists the grant ID alongside the consumed approval ID and authorisation timestamp, preserving grant-to-run audit lineage. If the runtime call fails after consumption, the record remains consumed; inspect the run before requesting a fresh approval.

The runtime independently recomputes the canonical digest from its persisted plan and verifies the registered capability/action/version. Its authorisation endpoint enforces the 2 KiB request-body limit while streaming the body, so a missing or dishonest `Content-Length` header cannot bypass the bound; oversized streams are cancelled and rejected with `413` before JSON parsing or database access. It records one approval ID per run using a unique database index and an atomic conditional update, then appends a deterministic `execution_authorized` event. Replaying the same approval is idempotent; a different approval or changed plan is rejected. This transition does not enqueue a queue message, claim a worker, invoke a model, or execute a tool. `executionAuthorized` is exposed as a status fact only.

**Important:** this is the completed human-approval-to-runtime-authorisation record handoff, not specialist execution. The actual specialist worker, exact resource-grant enforcement at invocation, and tool execution remain unimplemented and fail-closed.

The owner-only Pages route also provides a bounded AG-UI 1.0 terminal replay:

```http
GET /api/agent-runs/<uuid>/ag-ui
Accept: text/event-stream
```

It is available only after a run reaches `planned`, `cancelled` or `failed`; active runs return `409`. It pages through at most 200 append-only lifecycle events, orders them oldest-first, and emits one AG-UI JSON event per SSE data frame. AEGIS currently has no separate conversation-thread record, so a plan-only run uses its run ID as both `threadId` and `runId`. Stored lifecycle entries are represented as `CUSTOM` events named `aegis.agent_run.lifecycle`, carrying only the event ID and event type—not the raw event detail, objective, plan, credentials or prompts. The stream closes with `RUN_FINISHED` (success/cancelled) or `RUN_ERROR`.

This is a terminal-history replay adapter, not a live subscription or stream-resumption implementation. It deliberately does not fabricate assistant messages, tool calls, reasoning or subagent execution. Live AG-UI streaming can be added when the worker-execution stage exists.

### Health

```http
GET /health
Authorization: Bearer <token>
```

Health only reports ready when both D1 and Queue bindings are present.

## Storage

Migrations:

- `migrations/runtime/0001_jobs.sql` — durable jobs and job events.
- `migrations/runtime/0002_agent_runs.sql` — durable agent run plans and append-only events.
- `migrations/runtime/0003_agent_run_cancellation.sql` — cancellation marker and pending-dispatch index.
- `migrations/runtime/0004_agent_run_listing.sql` — stable creation-time/ID index for keyset pagination.
- `migrations/runtime/0005_agent_run_event_listing.sql` — per-run event timeline cursor index.
- `migrations/runtime/0006_agent_run_execution_authorization.sql` — one-time approval ID, exact grant ID and authorisation timestamp, with a unique approval-consumption index.
- `migrations/runtime/0007_agent_run_steps.sql` — durable ordered agent-run steps, checkpoint/result slots, append-only step events and lease/status indexes.
- `migrations/runtime/0008_agent_run_project_context.sql` — owner Project Space ID, bounded context snapshot JSON and project/time index.

- `jobs` stores the current state, strict task type, JSON payload, attempts, idempotency key, result, stable error code and lease.
- `job_events` stores state-transition audit events.
- `agent_runs` stores bounded objectives, approved specialist-role selections, plan output, attempt/lease state, cancellation marker, selected Project Space ID and the verified context snapshot.
- `agent_run_events` stores append-only agent-run lifecycle events, including one-time execution-authorisation records.
- `agent_run_steps` stores each deterministic plan step and its checkpoint/result state; `agent_run_step_events` stores append-only per-step lifecycle records.
- `agent_runs.authorization_approval_id`, `authorization_grant_id` and `execution_authorized_at` record the consumed owner approval, exact resource grant and authorisation time; the unique partial index prevents one approval being attached to multiple runs.
- Foreign keys and indexes support job lookup, pending dispatch and lease recovery.

## Pages owner proxy and Agent Workforce console

The Pages app now exposes owner-authenticated proxy routes for the separate runtime Worker:

- `GET /api/agent-runs?limit=20` — list recent runs.
- `POST /api/agent-runs` — submit a bounded objective and optional specialist list.
- `GET /api/agent-runs/:id` — inspect a run and its plan.
- `GET /api/agent-runs/:id/events` — read the append-only event timeline.
- `GET /api/agent-runs/:id/ag-ui` — owner-only, bounded AG-UI 1.0 SSE replay for terminal runs.
- `POST /api/agent-runs/:id/cancel` — cancel an eligible run.

The Security Centre contains an Agent Workforce console for creating, inspecting, refreshing and cancelling plan-only runs, preparing an exact execution grant, and requesting owner approval for a completed plan. The Approval inbox uses the capability-scoped Sentinel decision route and exact-grant check before runtime authorisation. Approval and authorisation records do not start a worker: no specialist model calls, tool execution or external actions occur.

Configure these as **server-side Pages environment variables** only after the runtime Worker is deployed:

- `AEGIS_RUNTIME_URL` — the HTTPS origin of the dedicated runtime Worker, with no path, query or credentials.
- `AEGIS_JOB_TOKEN` — the same high-entropy bearer secret configured on the runtime Worker.

The Pages proxy never sends the runtime token to the browser. It requires the existing owner session, checks same-origin writes, uses fixed allowlisted runtime paths, rejects redirects, bounds request/response sizes and applies an eight-second upstream timeout. Missing or invalid configuration fails closed. Do not put either value in `index.html`, client JavaScript, source control or chat.

## Deployment preparation

The Worker has a Wrangler template at `workers/runtime/wrangler.toml.example`. It contains a placeholder D1 database ID and is intentionally not a deployable production config until the real resource ID is inserted.

The following operations create Cloudflare resources and deploy a new Worker. They have **not** been run as part of this code change:

1. Create D1 database `aegis-runtime` in the Western Europe region where available.
2. Create Queue `aegis-jobs`. The configured dead-letter queue `aegis-jobs-dlq` is created automatically by Cloudflare when the consumer is configured.
3. Copy the example config to `workers/runtime/wrangler.toml` and replace the D1 placeholder with the actual database ID.
4. Apply the migration remotely.
5. Set a unique random `AEGIS_JOB_TOKEN` using Wrangler's encrypted Worker secret command.
6. Deploy the Worker and verify health, submission, completion, idempotency, Cron recovery and failure handling.

Typical Wrangler commands (run from the repository root, after creating the config and authenticating Wrangler):

```sh
npx wrangler d1 create aegis-runtime --location weur
npx wrangler queues create aegis-jobs
npx wrangler d1 migrations apply aegis-runtime --remote --config workers/runtime/wrangler.toml
npx wrangler secret put AEGIS_JOB_TOKEN --config workers/runtime/wrangler.toml
npx wrangler deploy --config workers/runtime/wrangler.toml
```

The D1 creation command returns the database ID that must be inserted into the config before applying migrations or deploying. Do not commit the completed config if it contains environment-specific resource IDs without checking repository policy; never commit the secret.

Cloudflare documents D1 creation and migration commands and Queue consumer/dead-letter configuration here:
- https://developers.cloudflare.com/d1/wrangler-commands/
- https://developers.cloudflare.com/queues/configuration/configure-queues/
- https://developers.cloudflare.com/queues/configuration/dead-letter-queues/

## Security and limitations

- The Worker is separate from the existing Pages production deployment. The Pages proxy and Agent Workforce console are now in source and preview builds, but remain unavailable until the separate runtime Worker is deployed and the two server-side Pages variables above are configured.
- Bearer-token auth is an interim private service credential, not OAuth 2.1 or multi-user identity.
- Origin validation is applied when a browser Origin is present; server-to-server clients may omit Origin.
- No permissive CORS is enabled.
- Request bodies are capped at 8 KiB.
- Only the health-check task is accepted; payload fields are rejected.
- Job cancellation, plan-only owner approval, exact-plan approval consumption, exact-resource grant enforcement and runtime authorisation recording are implemented for agent runs. General job cancellation, user-supplied code, arbitrary connectors, model calls and specialist execution are not implemented.
- D1 and Queue resource creation/deployment need explicit review and a cost/limit check before use.
- Queue delivery is at-least-once. Idempotent state transitions, leases and attempt fencing reduce duplicate execution risks; new task handlers must themselves be idempotent.

## Free-tier guardrails

The Cloudflare documentation checked on 15 November 2026 lists these Workers Free allowances:

- Workers: 100,000 requests/day and 10 ms CPU time per invocation.
- D1: 5 million rows read/day, 100,000 rows written/day and 5 GB total account storage.
- Queues: 10,000 operations/day; Free-plan messages are retained for 24 hours. A normal delivered message typically uses one write, one read and one delete operation; retries add read operations.

These are account-level limits, not dedicated AEGIS quotas. Other projects on the same Cloudflare account may consume them. Exceeding D1 daily row limits causes queries to fail until reset; exceeding Queue operations may cause sends/processing to fail. AEGIS must surface quota errors, retain pending jobs for later dispatch, and avoid automatically upgrading the account or enabling paid usage.

The current once-per-minute recovery Cron uses one stale-lease query and one pending-outbox query per run, plus writes/events only when rows need recovery. This is intentionally bounded. Before activation, inspect account-wide usage and available Cron trigger quota.

References:
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/queues/platform/pricing/
- https://developers.cloudflare.com/queues/platform/limits/

## Verification

CI workflow: `node --test tests/*.test.mjs` on Node.js 22, followed by isolated D1 migration/constraint checks and a Miniflare Worker + D1 + Queue integration test.

At commit `a4ac9373ba076a3194b8a0694e6c4fd4b7e3fa1b`, GitHub Actions run [43908042920](https://github.com/LAURENCE1977/Aegis-/actions/runs/43908042920) completed successfully:

- **556 Node.js tests: 555 passed, 0 failed, 1 skipped.** The skipped test is the dedicated integration test, which runs separately with its required emulator flag.
- **Miniflare integration: 1 passed, 0 failed.** It loads the actual runtime Worker module, applies all runtime D1 migrations to an isolated local D1 database, submits an authenticated agent run through the Worker HTTP endpoint, delivers the message through a local Queue consumer, and verifies the persisted plan, ordered step records, append-only step events, run audit timeline and idempotent replay.
- Capability D1 migrations, table/constraint smoke tests, atomic rate-limit reservation, active-grant uniqueness and append-only audit checks passed.
- Runtime D1 migrations, durable cancellation, step cancellation and append-only event checks passed.
- Forge migrations, licence gates, immutable source identity and append-only review-event checks passed.

The integration test uses the Cloudflare workerd/Miniflare emulator, not a live Cloudflare account. It proves the Worker/D1/Queue code path in an isolated local runtime; it does **not** prove production resource provisioning, live Cloudflare queue delivery, Cron scheduling, free-tier headroom or a production deployment.

Agent-run creation and its initial `created` event are written atomically. Plan completion and all ordered step records/events are committed in one D1 batch. The step ledger has stable run-scoped IDs, plan snapshots, status, attempts, checkpoint/result slots and append-only lifecycle events. Cancellation fences the parent run and marks non-terminal steps cancelled in the same D1 batch. Idempotency-key replay returns the original run and does not append a second creation event. The status endpoint exposes ordered step states to the owner.

These durable step records are a checkpoint foundation only. They remain `planned` until a separately implemented, approved step executor exists; no specialist model, tool or external action is invoked.

The Cloudflare Pages preview remains separate from the dedicated runtime Worker. No production D1 database or Queue has been provisioned, no runtime Worker has been deployed, and no production `AEGIS_JOB_TOKEN` has been configured. Production activation remains gated on account usage review, explicit approval of any resource creation and encrypted secret configuration.
