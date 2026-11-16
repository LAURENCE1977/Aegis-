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

- `jobs` stores the current state, strict task type, JSON payload, attempts, idempotency key, result, stable error code and lease.
- `job_events` stores state-transition audit events.
- `agent_runs` stores bounded objectives, approved specialist-role selections, plan output, attempt/lease state and the cancellation marker.
- `agent_run_events` stores append-only agent-run lifecycle events.
- Foreign keys and indexes support job lookup, pending dispatch and lease recovery.

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

- The Worker is separate from the existing Pages production deployment.
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

The initial runtime branch test run completed with **82 tests passed, 0 failed**. Tests cover strict job validation, UUIDs, terminal states, auth fail-closed behavior, hostile Origin rejection, readiness checks, durable submission, idempotency, successful queue execution and a lease-recovery race regression. The regression failed against the old implementation (82 passed, 1 failed) and passed after the atomic-claim fix (83 passed, 0 failed). This is source-level test evidence, not a live Cloudflare integration test.

Next: add D1/Queue integration tests against a disposable non-production environment, then provision and deploy only after the free-tier and resource configuration are checked.

### Dead-letter recovery regression coverage

The current DLQ recovery change also covers two edge cases: a running job whose lease has expired is failed with the stable `JOB_DELIVERY_EXHAUSTED` code, while a malformed dead-letter identifier is acknowledged without mutating any job or audit state. A fresh full-suite CI run is required for the latest PR head. The Pages preview does not deploy the separate runtime Worker or apply its D1 migrations.
