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
- **Attempt fencing:** every claim increments an attempt counter; completion/retry updates are conditional on that exact attempt so an expired worker cannot overwrite a newer attempt.
- **Idempotency:** optional `Idempotency-Key` prevents duplicate job creation for the same request key.
- **Dead-letter queue:** the consumer config routes repeatedly undeliverable messages to `aegis-jobs-dlq`.

The job states are:

`pending_dispatch → queued → running → succeeded | failed`

A retry returns a running job to `queued`. An expired running lease is returned to `pending_dispatch` so the outbox sweep can re-enqueue it.

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

### Health

```http
GET /health
Authorization: Bearer <token>
```

Health only reports ready when both D1 and Queue bindings are present.

## Storage

Migration: `migrations/runtime/0001_jobs.sql`

- `jobs` stores the current state, strict task type, JSON payload, attempts, idempotency key, result, stable error code and lease.
- `job_events` stores state-transition audit events.
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
- No job cancellation, approval workflow, user-supplied code, arbitrary connectors, model calls or agent execution are implemented.
- D1 and Queue resource creation/deployment need explicit review and a cost/limit check before use.
- Queue delivery is at-least-once. Idempotent state transitions, leases and attempt fencing reduce duplicate execution risks; new task handlers must themselves be idempotent.

## Verification

CI workflow: `node --test tests/*.test.mjs` on Node.js 22.

The initial runtime branch test run completed with **82 tests passed, 0 failed**. Tests cover strict job validation, UUIDs, terminal states, auth fail-closed behavior, hostile Origin rejection, readiness checks, durable submission, idempotency and successful queue execution. This is source-level test evidence, not a live Cloudflare integration test.

Next: add D1/Queue integration tests against a disposable non-production environment, then provision and deploy only after the free-tier and resource configuration are checked.
