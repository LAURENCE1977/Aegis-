import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const enabled = process.env.AEGIS_RUNTIME_INTEGRATION === '1';
const token = 'aegis-miniflare-integration-token-at-least-32-characters';

async function eventually(assertion, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try { return await assertion(); } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError || new Error('Condition was not reached before timeout.');
}

test('Cloudflare runtime persists an agent run in D1 and consumes its real local Queue message', {
  skip: !enabled && 'Set AEGIS_RUNTIME_INTEGRATION=1 after applying the runtime migrations with Wrangler.',
}, async () => {
  const { Miniflare } = await import('miniflare');
  const mf = new Miniflare({
    scriptPath: new URL('../workers/runtime/index.mjs', import.meta.url).pathname,
    modules: true,
    compatibilityDate: '2026-08-06',
    d1Persist: new URL('../.wrangler/test-runtime-d1/v3/d1', import.meta.url).pathname,
    bindings: {
      AEGIS_JOB_TOKEN: token,
      AGENT_RUNS_ENABLED: 'true',
    },
    d1Databases: {
      DB: '00000000-0000-0000-0000-000000000000',
    },
    queueProducers: {
      JOBS: 'aegis-jobs',
    },
    queueConsumers: {
      'aegis-jobs': {
        maxBatchSize: 1,
        maxBatchTimeout: 1,
        maxRetries: 3,
        deadLetterQueue: 'aegis-jobs-dlq',
      },
      'aegis-jobs-dlq': {
        maxBatchSize: 1,
        maxBatchTimeout: 1,
        maxRetries: 3,
      },
    },
    cf: false,
  });

  try {
    const db = await mf.getD1Database('DB');
    const schema = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('agent_runs', 'agent_run_events') ORDER BY name"
    ).all();
    assert.deepEqual(schema.results.map((row) => row.name), ['agent_run_events', 'agent_runs']);

    const idempotencyKey = 'miniflare-agent-run-' + randomUUID();
    const objective = 'Verify the production Worker runtime against local D1 and Queues';
    const response = await mf.dispatchFetch('https://runtime.test/v1/agent-runs', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        objective,
        specialists: ['researcher', 'engineer', 'reviewer'],
      }),
    });

    const responseText = await response.text();
    assert.equal(response.status, 201, responseText);
    const { run } = JSON.parse(responseText);
    assert.ok(run.id);
    assert.equal(run.status, 'queued');

    await eventually(async () => {
      const result = await mf.dispatchFetch('https://runtime.test/v1/agent-runs/' + run.id, {
        headers: { Authorization: 'Bearer ' + token },
      });
      assert.equal(result.status, 200);
      const body = await result.json();
      assert.equal(body.run.status, 'planned');
      assert.equal(body.run.plan.execution, 'plan-only');
      assert.equal(body.run.plan.safety.toolsInvoked, false);
      assert.deepEqual(body.run.plan.steps.map((step) => step.specialist), [
        'researcher', 'engineer', 'reviewer',
      ]);
    });

    const persisted = await db.prepare(
      'SELECT status, attempts, plan_json FROM agent_runs WHERE id = ?'
    ).bind(run.id).first();
    assert.equal(persisted.status, 'planned');
    assert.equal(persisted.attempts, 1);
    assert.ok(JSON.parse(persisted.plan_json));

    const events = await db.prepare(
      'SELECT event_type FROM agent_run_events WHERE agent_run_id = ? ORDER BY rowid'
    ).bind(run.id).all();
    assert.deepEqual(events.results.map((event) => event.event_type), [
      'created', 'queued', 'running', 'planned',
    ]);

    const duplicate = await mf.dispatchFetch('https://runtime.test/v1/agent-runs', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        objective,
        specialists: ['researcher', 'engineer', 'reviewer'],
      }),
    });
    assert.equal(duplicate.status, 201);
    assert.equal((await duplicate.json()).run.id, run.id);
    const count = await db.prepare('SELECT COUNT(*) AS count FROM agent_runs WHERE idempotency_key = ?')
      .bind(idempotencyKey).first();
    assert.equal(count.count, 1);
  } finally {
    await mf.dispose();
  }
});
