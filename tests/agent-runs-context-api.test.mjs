import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { createAgentRunsHandlers } from '../functions/api/agent-runs.js';

const secret = 'agent-runs-context-test-session-secret-with-entropy';

async function makeRequest(body) {
  return new Request('https://aegis.example/api/agent-runs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://aegis.example',
      Cookie: '__Host-aegis_session=' + await createSessionToken(secret),
    },
    body: JSON.stringify(body),
  });
}

test('passes the submitted objective into Project Space context retrieval', async () => {
  let capturedObjective;
  let proxiedBody;
  const handler = createAgentRunsHandlers(
    async options => {
      proxiedBody = options.body;
      return Response.json({ run: { id: '00000000-0000-4000-8000-000000000001' } }, { status: 201 });
    },
    async (_db, projectId, _now, objective) => {
      assert.equal(projectId, 'project-a');
      capturedObjective = objective;
      return {
        brief: { workspace: { id: projectId }, memories: [], recentEvents: [] },
        digest: 'sha256:' + 'a'.repeat(64),
        knowledge: [],
        knowledgeDigest: 'sha256:' + 'b'.repeat(64),
      };
    },
  );
  const response = await handler.onRequestPost({
    request: await makeRequest({
      objective: 'Safely retry durable agent jobs without duplicate side effects.',
      projectId: 'project-a',
    }),
    env: {
      AEGIS_PASSWORD: 'test-password-long-enough',
      AEGIS_SESSION_SECRET: secret,
      AEGIS_DB: { prepare() {} },
    },
  });

  assert.equal(response.status, 201);
  assert.equal(capturedObjective, 'Safely retry durable agent jobs without duplicate side effects.');
  assert.ok(proxiedBody.projectContext);
});

test('agent run API rejects specialists outside the canonical registry before runtime dispatch', async () => {
  let proxyCalls = 0;
  const handler = createAgentRunsHandlers(async () => {
    proxyCalls += 1;
    return Response.json({ run: { id: 'unexpected' } }, { status: 201 });
  });
  for (const body of [
    { objective: 'Review safely', specialists: ['shell'] },
    { objective: 'Review safely', specialists: ['reviewer', 'reviewer'] },
    { objective: 'Review safely', extra: true },
  ]) {
    const response = await handler.onRequestPost({
      request: await makeRequest(body),
      env: {
        AEGIS_PASSWORD: 'test-password-long-enough',
        AEGIS_SESSION_SECRET: secret,
      },
    });
    assert.equal(response.status, 400);
  }
  assert.equal(proxyCalls, 0);
});

test('agent run API sends the canonical default specialist set when roles are omitted', async () => {
  let proxiedBody;
  const handler = createAgentRunsHandlers(async options => {
    proxiedBody = options.body;
    return Response.json({ run: { id: '00000000-0000-4000-8000-000000000002' } }, { status: 201 });
  });
  const response = await handler.onRequestPost({
    request: await makeRequest({ objective: '  Review the runtime  ' }),
    env: {
      AEGIS_PASSWORD: 'test-password-long-enough',
      AEGIS_SESSION_SECRET: secret,
    },
  });
  assert.equal(response.status, 201);
  assert.equal(proxiedBody.objective, 'Review the runtime');
  assert.deepEqual(proxiedBody.specialists, ['researcher', 'engineer', 'reviewer']);
});
