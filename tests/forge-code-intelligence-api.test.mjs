import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestPost } from '../functions/api/forge/code-intelligence.js';

const secret = 'forge-code-intelligence-api-test-secret-long-enough';
const env = { AEGIS_PASSWORD: 'test-password-long-enough', AEGIS_SESSION_SECRET: secret };

async function request(body, { authenticated = true, origin = 'https://aegis.example' } = {}) {
  const headers = { 'Content-Type': 'application/json', Origin: origin };
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
  return new Request('https://aegis.example/api/forge/code-intelligence', {
    method: 'POST', headers, body: JSON.stringify(body),
  });
}

test('Forge code intelligence requires authentication and same-origin requests', async () => {
  const unauthenticated = await onRequestPost({
    request: await request({ files: [] }, { authenticated: false }), env,
  });
  assert.equal(unauthenticated.status, 401);
  const crossOrigin = await onRequestPost({
    request: await request({ files: [] }, { origin: 'https://attacker.example' }), env,
  });
  assert.equal(crossOrigin.status, 403);
});

test('Forge code intelligence returns a bounded static graph without executing source', async () => {
  const response = await onRequestPost({
    request: await request({ files: [
      { path: 'src/main.ts', content: "import './core/boot';" },
      { path: 'src/core/boot.ts', content: 'export const boot = true;' },
    ] }), env,
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.graph.execution, 'none');
  assert.equal(body.graph.nodes.length, 2);
  assert.equal(body.graph.edges.length, 1);
});

test('Forge code intelligence rejects unknown request fields and invalid source paths', async () => {
  const unknown = await onRequestPost({
    request: await request({ files: [], execute: true }), env,
  });
  assert.equal(unknown.status, 400);
  const invalidPath = await onRequestPost({
    request: await request({ files: [{ path: '../secret.js', content: '' }] }), env,
  });
  assert.equal(invalidPath.status, 400);
});
