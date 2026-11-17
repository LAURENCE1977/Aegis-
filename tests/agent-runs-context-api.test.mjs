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
