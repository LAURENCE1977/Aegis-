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

Agent runs currently create a plan only; they do not execute specialist work. The owner can cancel an agent run with `POST /v1/agent-runs/{id}/cancel`. Cancellation is stored in `cancelled_at` and exposed as the terminal API status `cancelled`, preserving the existing constrained status enum and event foreign keys. Pending dispatch, queued, running and planned runs can be cancelled; failed runs cannot. Claims, plan completion, retries and outbox dispatch all check the cancellation marker, so a queue delivery racing with cancellation is acknowledged without planning or retrying. Repeating cancellation is idempotent and the append-only event is written once.

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

The specialist list is optional and is limited to the server-defined roles: researcher, planner, engineer, security and reviewer. The default is researcher, engineer and reviewer. The response contains the durable run ID and current state.

```http
GET /v1/agent-runs/<uuid>
Authorization: Bearer <token>
```

```http
POST /v1/agent-runs/<uuid>/cancel
Authorization: Bearer <token>
```

Cancellation is idempotent. The API returns the run with status `cancelled`; a worker or queue delivery that races with cancellation cannot persist a plan or schedule a retry. Failed runs return `409` because they are already terminal.

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

- `jobs` stores the current state, strict task type, JSON payload, attempts, idempotency key, result, stable error code and lease.
- `job_events` stores state-transition audit events.
- `agent_runs` stores bounded objectives, approved specialist-role selections, plan output, attempt/lease state and the cancellation marker.
- `agent_run_events` stores append-only agent-run lifecycle events.
- Foreign keys and indexes support job lookup, pending dispatch and lease recovery.

## Pages owner proxy and Agent Workforce console

The Pages app now exposes owner-authenticated proxy routes for the separate runtime Worker:

- `GET /api/agent-runs?limit=20` — list recent runs.
- `POST /api/agent-runs` — submit a bounded objective and optional specialist list.
- `GET /api/agent-runs/:id` — inspect a run and its plan.
- `GET /api/agent-runs/:id/events` — read the append-only event timeline.
- `POST /api/agent-runs/:id/cancel` — cancel an eligible run.

The Security Centre contains an Agent Workforce console for creating, inspecting, refreshing and cancelling plan-only runs. It clearly labels the current stage: no specialist model calls, tool execution or external actions occur.

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
- Job cancellation is implemented for agent runs only. General job cancellation, approval workflow, user-supplied code, arbitrary connectors, model calls or specialist execution are not implemented.
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

CI workflow: `node --test tests/*.test.mjs` on Node.js 22.

At commit `5c36daa16378af68b3cee2357d92844983f08c14`, GitHub Actions run [43867919171](https://github.com/LAURENCE1977/Aegis-/actions/runs/43867919171) completed successfully: **509 tests passed, 0 failed**. The same run applied the capability and runtime migrations to an isolated local D1 database and passed the rate-limit, active-grant uniqueness, append-only audit, durable agent-run cancellation/event and Forge licence/source-integrity checks.

The event timeline tests cover bounded pages, newest-first ordering, timestamp ties, stable cursor continuation and malformed/duplicate query rejection. The migration adds the composite index `(agent_run_id, created_at DESC, event_id DESC)`.

The Cloudflare Pages preview also deployed successfully for this commit. That preview is the app/site preview only: it does **not** deploy the separate runtime Worker, provision production D1/Queue resources or run a live queue integration test. Production runtime deployment remains gated on explicit configuration, free-tier review and a separate deployment decision.

The suite is source/isolated-D1 evidence, not proof of live Cloudflare Worker + Queue behavior.
