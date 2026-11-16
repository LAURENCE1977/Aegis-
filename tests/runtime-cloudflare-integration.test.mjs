import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';

const token = 'aegis-miniflare-integration-token-at-least-32-characters';
const migrationFiles = [
  '0001_jobs.sql',
  '0002_agent_runs.sql',
  '0003_agent_run_cancellation.sql',
  '0004_agent_run_listing.sql',
  '0005_agent_run_event_listing.sql',
  '0006_agent_run_execution_authorization.sql',
];

async function eventually(assertion, timeoutMs = 8000) {
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

test('Cloudflare runtime persists an agent run in D1 and consumes its real local Queue message', async () => {
  const mf = new Miniflare({
    scriptPath: new URL('../workers/runtime/index.mjs', import.meta.url).pathname,
    modules: true,
    compatibilityDate: '2026-08-06',
    bindings: {
      AEGIS_JOB_TOKEN: token,
      AGENT_RUNS_ENABLED: 'true',
    },
    d1Databases: {
      DB: '00000000-0000-4000-8000-000000000001',
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
    for (const migration of migrationFiles) {
      const sql = await readFile(new URL('../migrations/runtime/' + migration, import.meta.url), 'utf8');
      // D1 manages foreign-key enforcement; its SQL API intentionally rejects PRAGMA statements.\n      await db.exec(sql.replace(/^\\s*PRAGMA\\s+foreign_keys\\s*=\\s*ON\\s*;\\s*/gim, ''));
    }

    const schema = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('agent_runs', 'agent_run_events') ORDER BY name"
    ).all();
    assert.deepEqual(schema.results.map((row) => row.name), ['agent_run_events', 'agent_runs']);

    const response = await mf.dispatchFetch('https://runtime.test/v1/agent-runs', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'miniflare-agent-run-0001',
      },
      body: JSON.stringify({
        objective: 'Verify the production Worker runtime against local D1 and Queues',
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
      'SELECT event_type FROM agent_run_events WHERE agent_run_id = ? ORDER BY created_at, event_id'
    ).bind(run.id).all();
    assert.deepEqual(events.results.map((event) => event.event_type), [
      'created', 'queued', 'running', 'planned',
    ]);

    const duplicate = await mf.dispatchFetch('https://runtime.test/v1/agent-runs', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'miniflare-agent-run-0001',
      },
      body: JSON.stringify({
        objective: 'Verify the production Worker runtime against local D1 and Queues',
        specialists: ['researcher', 'engineer', 'reviewer'],
      }),
    });
    assert.equal(duplicate.status, 201);
    assert.equal((await duplicate.json()).run.id, run.id);
    const count = await db.prepare('SELECT COUNT(*) AS count FROM agent_runs').first();
    assert.equal(count.count, 1);
  } finally {
    await mf.dispose();
  }
});
