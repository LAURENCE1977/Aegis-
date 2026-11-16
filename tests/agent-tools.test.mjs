import test from 'node:test';
import assert from 'node:assert/strict';
import {
  executeAgentToolCall,
  getAgentToolDefinitions,
  isAgentToolingEnabled,
} from '../functions/lib/agent-tools.mjs';

class MemoryD1 {
  constructor(grantRow = null, rateLimitRow = { request_count: 1 }) {
    this.grantRow = grantRow;
    this.rateLimitRow = rateLimitRow;
    this.auditRows = [];
  }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async first() {
        if (sql.includes('FROM capability_grants')) return db.grantRow ? { ...db.grantRow } : null;
        if (sql.includes('INSERT INTO capability_invocation_limits')) return db.rateLimitRow;
        return null;
      },
      async run() {
        if (sql.includes('INSERT INTO capability_invocation_audit')) db.auditRows.push(this.values);
        return { meta: { changes: 1 } };
      },
    };
  }
}

function grant(capabilityId, resourceId, scopes) {
  const now = Date.now();
  return {
    id: 'grant-1',
    principal_id: 'owner',
    capability_id: capabilityId,
    capability_version: '0.1.0',
    resource_id: resourceId,
    scopes_json: JSON.stringify(scopes),
    status: 'active',
    created_by: 'owner',
    created_at: new Date(now - 1000).toISOString(),
    expires_at: new Date(now + 60_000).toISOString(),
    revoked_at: null,
  };
}

const githubResponse = () => new Response(JSON.stringify({
  full_name: 'Example/Repo',
  html_url: 'https://github.com/Example/Repo',
  description: 'Public repo',
  default_branch: 'main',
  private: false,
  archived: false,
  fork: false,
  pushed_at: '2026-11-01T00:00:00Z',
  stargazers_count: 2,
  language: 'JavaScript',
  license: { spdx_id: 'MIT', name: 'MIT License' },
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

test('agent tools are server-defined and expose only the two approved read-only actions', () => {
  const tools = getAgentToolDefinitions();
  assert.deepEqual(tools.map(tool => tool.function.name), [
    'aegis_list_modules',
    'aegis_discover_public_github_repository',
  ]);
  assert.equal(tools.every(tool => tool.type === 'function'), true);
  assert.equal(tools[0].function.parameters.additionalProperties, false);
  assert.equal(tools[1].function.parameters.additionalProperties, false);
});

test('agent tools remain disabled unless the owner explicitly enables a supported Qwen provider with D1', () => {
  const db = new MemoryD1();
  const configured = {
    AEGIS_AGENT_TOOLS_ENABLED: 'true',
    AEGIS_MODEL_PROVIDER: 'alibaba-qwen',
    AEGIS_QWEN_API_KEY: 'test-qwen-api-key-long-enough',
    AEGIS_QWEN_WORKSPACE_ID: 'workspace-123',
    AEGIS_QWEN_REGION: 'ap-southeast-1',
    AEGIS_DB: db,
  };
  assert.equal(isAgentToolingEnabled(configured), true);
  assert.equal(isAgentToolingEnabled({ ...configured, AEGIS_AGENT_TOOLS_ENABLED: 'false' }), false);
  assert.equal(isAgentToolingEnabled({ ...configured, AEGIS_MODEL_PROVIDER: 'workers-ai' }), false);
  assert.equal(isAgentToolingEnabled({ ...configured, AEGIS_DB: undefined }), false);
  assert.equal(isAgentToolingEnabled({ ...configured, AEGIS_QWEN_API_KEY: undefined }), false);
});

test('unknown tool names and malformed arguments fail before D1 access', async () => {
  const db = new MemoryD1();
  const unknown = await executeAgentToolCall({
    name: 'run_shell',
    argumentsText: '{}',
    db,
  });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reasonCode, 'TOOL_NOT_ALLOWED');
  const invalid = await executeAgentToolCall({
    name: 'aegis_list_modules',
    argumentsText: '{"command":"whoami"}',
    db,
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.reasonCode, 'INVALID_TOOL_ARGUMENTS');
  assert.equal(db.auditRows.length, 0);
});

test('module catalogue tool runs through Sentinel exact grants, rate limits and audit', async () => {
  const db = new MemoryD1(grant(
    'aegis-module-catalogue',
    'aegis:modules',
    ['aegis:module-catalogue:read'],
  ));
  const result = await executeAgentToolCall({
    name: 'aegis_list_modules',
    argumentsText: '{}',
    db,
  });
  assert.equal(result.ok, true);
  assert.equal(result.reasonCode, 'SUCCESS');
  assert.ok(result.output.modules.some(module => module.id === 'forge'));
  assert.equal(db.auditRows.length, 3);
  assert.ok(db.auditRows.every(row => row[3] === 'owner'));
});

test('public GitHub tool derives exact resource and uses the bounded Sentinel adapter', async () => {
  const db = new MemoryD1(grant(
    'aegis-github-public-discovery',
    'github:public:Example/Repo',
    ['github:public-metadata:read'],
  ));
  let requestedUrl;
  const result = await executeAgentToolCall({
    name: 'aegis_discover_public_github_repository',
    argumentsText: JSON.stringify({ sourceUrl: 'https://github.com/Example/Repo.git' }),
    db,
    fetchImpl: async url => {
      requestedUrl = url;
      return githubResponse();
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.output.fullName, 'Example/Repo');
  assert.equal(requestedUrl, 'https://api.github.com/repos/Example/Repo');
  assert.equal(db.auditRows.length, 3);
});

test('GitHub tool cannot choose a different resource or endpoint and requires the exact grant', async () => {
  const db = new MemoryD1();
  let fetchCalls = 0;
  const result = await executeAgentToolCall({
    name: 'aegis_discover_public_github_repository',
    argumentsText: JSON.stringify({
      sourceUrl: 'https://github.com/Example/Repo',
      endpoint: 'https://attacker.example',
    }),
    db,
    fetchImpl: async () => { fetchCalls += 1; throw new Error('must not fetch'); },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, 'INVALID_TOOL_ARGUMENTS');
  assert.equal(fetchCalls, 0);
  assert.equal(db.auditRows.length, 0);
});
