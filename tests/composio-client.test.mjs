import test from 'node:test';
import assert from 'node:assert/strict';
import { createComposioClient } from '../functions/lib/composio-client.mjs';

const apiKey = 'test-composio-project-key';
const sessionId = 'trs_1a2b3c4d5e6f';

function jsonResponse(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function requestUrl(input) {
  return typeof input === 'string' ? input : input.url;
}

test('requires a server-side API key and a fetch implementation', () => {
  assert.throws(() => createComposioClient({}), /API key/i);
  assert.throws(() => createComposioClient({ apiKey: '   ' }), /API key/i);
  assert.throws(() => createComposioClient({ apiKey, fetchImpl: null }), /fetch/i);
});

test('creates a narrowly allowlisted GitHub session with no MCP or broad tool search', async () => {
  let captured;
  const client = createComposioClient({
    apiKey,
    fetchImpl: async (url, options) => {
      captured = { url: requestUrl(url), options, body: JSON.parse(options.body) };
      return jsonResponse({ session_id: sessionId });
    },
  });

  const result = await client.createReadOnlyGitHubSession({ userId: 'owner' });

  assert.deepEqual(result, { sessionId });
  assert.equal(captured.url, 'https://backend.composio.dev/api/v3.1/tool_router/session');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.redirect, 'error');
  assert.equal(captured.options.headers['x-api-key'], apiKey);
  assert.deepEqual(captured.body.toolkits, { enable: ['github'] });
  assert.deepEqual(captured.body.tools, {
    github: { enable: ['GITHUB_GET_A_REPOSITORY'] },
  });
  assert.deepEqual(captured.body.search, { enable: false });
  assert.deepEqual(captured.body.execute, { enable_multi_execute: false });
  assert.deepEqual(captured.body.workbench, { enable: false });
  assert.deepEqual(captured.body.preload, { tools: ['GITHUB_GET_A_REPOSITORY'] });
  assert.equal(Object.hasOwn(captured.body, 'mcp'), false);
});

test('rejects invalid Composio user identifiers before making a request', async () => {
  let calls = 0;
  const client = createComposioClient({
    apiKey,
    fetchImpl: async () => { calls += 1; return jsonResponse({ session_id: sessionId }); },
  });

  await assert.rejects(client.createReadOnlyGitHubSession({ userId: 'owner\nattacker' }), /user ID/i);
  assert.equal(calls, 0);
});

test('creates a GitHub OAuth link only for the validated session and toolkit', async () => {
  let captured;
  const client = createComposioClient({
    apiKey,
    fetchImpl: async (url, options) => {
      captured = { url: requestUrl(url), body: JSON.parse(options.body) };
      return jsonResponse({
        redirect_url: 'https://connect.composio.dev/link/lt_abc123',
        connected_account_id: 'ca_abc123',
      }, 201);
    },
  });

  const result = await client.createGitHubLink({ sessionId });
  assert.deepEqual(result, {
    redirectUrl: 'https://connect.composio.dev/link/lt_abc123',
    connectedAccountId: 'ca_abc123',
  });
  assert.equal(captured.url, `https://backend.composio.dev/api/v3.1/tool_router/session/${sessionId}/link`);
  assert.deepEqual(captured.body, { toolkit: 'github' });
});

test('rejects a link redirect outside the Composio HTTPS allowlist', async () => {
  const client = createComposioClient({
    apiKey,
    fetchImpl: async () => jsonResponse({
      redirect_url: 'https://attacker.example/steal',
      connected_account_id: 'ca_abc123',
    }, 201),
  });

  await assert.rejects(client.createGitHubLink({ sessionId }), /redirect URL/i);
});

test('lists only validated tool slugs from the session tool catalogue', async () => {
  let captured;
  const client = createComposioClient({
    apiKey,
    fetchImpl: async (url, options) => {
      captured = { url: requestUrl(url), options };
      return jsonResponse({
        items: [
          { slug: 'GITHUB_GET_A_REPOSITORY' },
          { slug: 'GITHUB_LIST_PULL_REQUESTS' },
        ],
        next_cursor: null,
      });
    },
  });

  const result = await client.listSessionTools({ sessionId });
  assert.deepEqual(result, ['GITHUB_GET_A_REPOSITORY', 'GITHUB_LIST_PULL_REQUESTS']);
  assert.equal(captured.url, `https://backend.composio.dev/api/v3.1/tool_router/session/${sessionId}/tools?limit=100`);
  assert.equal(captured.options.method, 'GET');
});

test('executes only the fixed read-only repository metadata tool', async () => {
  let captured;
  const client = createComposioClient({
    apiKey,
    fetchImpl: async (url, options) => {
      captured = { url: requestUrl(url), options, body: JSON.parse(options.body) };
      return jsonResponse({
        data: { full_name: 'octocat/Hello-World', private: false },
        error: null,
        log_id: 'log_123',
      });
    },
  });

  const result = await client.executeGitHubGetRepository({
    sessionId,
    owner: 'octocat',
    repo: 'Hello-World',
    connectedAccountId: 'ca_abc123xyz',
  });

  assert.deepEqual(result, {
    data: { full_name: 'octocat/Hello-World', private: false },
    logId: 'log_123',
  });
  assert.equal(captured.url, `https://backend.composio.dev/api/v3.1/tool_router/session/${sessionId}/execute`);
  assert.deepEqual(captured.body, {
    tool_slug: 'GITHUB_GET_A_REPOSITORY',
    arguments: { owner: 'octocat', repo: 'Hello-World' },
    account: 'ca_abc123xyz',
  });
  assert.equal(captured.options.headers['x-api-key'], apiKey);
  assert.equal(captured.options.redirect, 'error');
});

test('rejects invalid repository identifiers and session IDs without network access', async () => {
  let calls = 0;
  const client = createComposioClient({
    apiKey,
    fetchImpl: async () => { calls += 1; return jsonResponse({ data: {} }); },
  });

  await assert.rejects(client.executeGitHubGetRepository({
    sessionId,
    owner: 'octocat/other',
    repo: 'Hello-World',
  }), /owner/i);
  await assert.rejects(client.executeGitHubGetRepository({
    sessionId,
    owner: 'octocat',
    repo: '../secrets',
  }), /repository/i);
  await assert.rejects(client.executeGitHubGetRepository({
    sessionId: 'https://attacker.example',
    owner: 'octocat',
    repo: 'Hello-World',
  }), /session ID/i);
  assert.equal(calls, 0);
});

test('rejects redirects and non-JSON responses without following them', async () => {
  const redirectClient = createComposioClient({
    apiKey,
    fetchImpl: async (_url, options) => {
      assert.equal(options.redirect, 'error');
      return new Response(null, { status: 302, headers: { Location: 'https://attacker.example' } });
    },
  });
  await assert.rejects(
    redirectClient.createReadOnlyGitHubSession({ userId: 'owner' }),
    /Composio request failed/i,
  );

  const htmlClient = createComposioClient({
    apiKey,
    fetchImpl: async () => new Response('<html>no</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }),
  });
  await assert.rejects(
    htmlClient.createReadOnlyGitHubSession({ userId: 'owner' }),
    /JSON response/i,
  );
});

test('bounds response bytes and sanitizes provider error bodies', async () => {
  const oversizedClient = createComposioClient({
    apiKey,
    maxResponseBytes: 1024,
    fetchImpl: async () => new Response('x'.repeat(2048), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  });
  await assert.rejects(
    oversizedClient.createReadOnlyGitHubSession({ userId: 'owner' }),
    /size limit/i,
  );

  const failingClient = createComposioClient({
    apiKey,
    fetchImpl: async () => jsonResponse({ error: 'secret=do-not-leak' }, 403),
  });
  await assert.rejects(
    failingClient.createReadOnlyGitHubSession({ userId: 'owner' }),
    (error) => {
      assert.match(error.message, /403/);
      assert.equal(error.message.includes('do-not-leak'), false);
      return true;
    },
  );
});

test('does not return provider credentials or response headers to callers', async () => {
  const client = createComposioClient({
    apiKey,
    fetchImpl: async () => jsonResponse({
      data: { full_name: 'octocat/Hello-World' },
      api_key: 'must-not-be-returned',
      headers: { authorization: 'must-not-be-returned' },
    }),
  });

  const result = await client.executeGitHubGetRepository({
    sessionId,
    owner: 'octocat',
    repo: 'Hello-World',
  });
  assert.equal(JSON.stringify(result).includes('must-not-be-returned'), false);
});

test('verifies the exact GitHub connected account is active before execution', async () => {
  let requestedUrl;
  const client = createComposioClient({
    apiKey,
    fetchImpl: async (url) => {
      requestedUrl = requestUrl(url);
      return jsonResponse({
        items: [{
          slug: 'github',
          connected_account: {
            id: 'ca_abc123xyz',
            status: 'ACTIVE',
          },
        }],
      });
    },
  });

  assert.equal(await client.getGitHubConnectionStatus({
    sessionId,
    connectedAccountId: 'ca_abc123xyz',
  }), true);
  assert.equal(
    requestedUrl,
    `https://backend.composio.dev/api/v3.1/tool_router/session/${sessionId}/toolkits?toolkits=github&limit=10`,
  );
});

test('treats pending or mismatched Composio accounts as not connected', async () => {
  const client = createComposioClient({
    apiKey,
    fetchImpl: async () => jsonResponse({
      items: [{
        slug: 'github',
        connected_account: {
          id: 'ca_different123',
          status: 'INITIATED',
        },
      }],
    }),
  });

  assert.equal(await client.getGitHubConnectionStatus({
    sessionId,
    connectedAccountId: 'ca_abc123xyz',
  }), false);
});

test('deletes a validated Composio session without exposing provider response data', async () => {
  let captured;
  const client = createComposioClient({
    apiKey,
    fetchImpl: async (url, options) => {
      captured = { url: requestUrl(url), options };
      return new Response(null, { status: 204 });
    },
  });
  assert.equal(await client.deleteSession({ sessionId }), true);
  assert.equal(
    captured.url,
    `https://backend.composio.dev/api/v3.1/tool_router/session/${sessionId}`,
  );
  assert.equal(captured.options.method, 'DELETE');
  assert.equal(captured.options.redirect, 'error');
});


test('allows only a same-origin HTTPS callback for Composio OAuth', async () => {
  let body;
  const client = createComposioClient({
    apiKey,
    callbackOrigin: 'https://aegis.example',
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return jsonResponse({
        redirect_url: 'https://app.composio.dev/link/lt_abc123',
        connected_account_id: 'ca_abc123xyz',
      }, 201);
    },
  });

  await client.createGitHubLink({
    sessionId,
    callbackUrl: 'https://aegis.example/?composio=connected',
  });
  assert.deepEqual(body, {
    toolkit: 'github',
    callback_url: 'https://aegis.example/?composio=connected',
  });
});

test('rejects a cross-origin or non-HTTPS Composio callback before network access', async () => {
  let calls = 0;
  const client = createComposioClient({
    apiKey,
    callbackOrigin: 'https://aegis.example',
    fetchImpl: async () => { calls += 1; return jsonResponse({}); },
  });

  await assert.rejects(client.createGitHubLink({
    sessionId,
    callbackUrl: 'https://attacker.example/return',
  }), /callback URL/i);
  await assert.rejects(client.createGitHubLink({
    sessionId,
    callbackUrl: 'http://aegis.example/return',
  }), /callback URL/i);
  assert.equal(calls, 0);
});


test('executes only the fixed read-only pull request metadata tool', async () => {
  let captured;
  const client = createComposioClient({
    apiKey,
    fetchImpl: async (url, options) => {
      captured = { url: requestUrl(url), options, body: JSON.parse(options.body) };
      return jsonResponse({
        data: { number: 101, title: 'AEGIS build', state: 'open', draft: true, merged: false },
        error: null,
        log_id: 'log_pr_101',
      });
    },
  });

  const result = await client.executeGitHubGetPullRequest({
    sessionId,
    owner: 'LAURENCE1977',
    repo: 'Aegis-',
    pullNumber: 101,
    connectedAccountId: 'ca_abc123xyz',
  });

  assert.deepEqual(result, {
    data: { number: 101, title: 'AEGIS build', state: 'open', draft: true, merged: false },
    logId: 'log_pr_101',
  });
  assert.equal(captured.url, `https://backend.composio.dev/api/v3.1/tool_router/session/${sessionId}/execute`);
  assert.deepEqual(captured.body, {
    tool_slug: 'GITHUB_GET_A_PULL_REQUEST',
    arguments: { owner: 'LAURENCE1977', repo: 'Aegis-', pull_number: 101 },
    account: 'ca_abc123xyz',
  });
});

test('rejects invalid pull request identifiers before any network access', async () => {
  let calls = 0;
  const client = createComposioClient({
    apiKey,
    fetchImpl: async () => { calls += 1; return jsonResponse({ data: {} }); },
  });
  await assert.rejects(client.executeGitHubGetPullRequest({
    sessionId, owner: 'LAURENCE1977', repo: 'Aegis-', pullNumber: 0,
  }), /pull request/i);
  await assert.rejects(client.executeGitHubGetPullRequest({
    sessionId, owner: 'LAURENCE1977', repo: 'Aegis-', pullNumber: 1.5,
  }), /pull request/i);
  assert.equal(calls, 0);
});
