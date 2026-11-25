import test from 'node:test';
import assert from 'node:assert/strict';
import { scrubSensitiveData } from '../functions/lib/data-guards.mjs';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestPost } from '../functions/api/memories.js';

const secret = 'data-guard-test-session-secret-with-enough-entropy';
const envBase = { AEGIS_PASSWORD: 'test-password-long-enough', AEGIS_SESSION_SECRET: secret };

class MemoryD1 {
  constructor() { this.records = []; }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        if (sql.includes('INSERT INTO aegis_memories')) {
          db.records.push({ content: this.values[4], source_type: this.values[5], source_attribution: this.values[7], status: this.values[11] });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        if (sql.includes('FROM project_spaces')) return null;
        return null;
      },
    };
  }
}

async function ownerRequest(body) {
  const token = await createSessionToken(secret);
  return new Request('https://aegis.example/api/memories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://aegis.example',
      Cookie: '__Host-aegis_session=' + token,
    },
    body: JSON.stringify(body),
  });
}

const memoryInput = {
  kind: 'fact',
  content: 'The access token is Bearer abcdefghijklmnopqrstuvwxyz123456',
  source: { type: 'user-stated', url: 'https://aegis.example/conversation/2', attribution: 'Owner: alex@example.com' },
};

test('secret and PII scrubber redacts bearer credentials and email addresses', () => {
  const result = scrubSensitiveData({
    content: 'Contact alex@example.com with Bearer abcdefghijklmnopqrstuvwxyz123456',
  });
  assert.equal(result.ok, true);
  assert.doesNotMatch(result.value.content, /alex@example\.com|abcdefghijklmnopqrstuvwxyz123456/);
  assert.ok(result.redactions >= 2);
});

test('configured PII values are parsed from the Cloudflare environment string', () => {
  const result = scrubSensitiveData({ note: 'Call the owner at private-code-77' }, {
    piiValues: JSON.stringify(['private-code-77']),
  });
  assert.equal(result.ok, true);
  assert.doesNotMatch(result.value.note, /private-code-77/);
});

test('invalid configured PII values fail closed', () => {
  assert.equal(scrubSensitiveData({ note: 'text' }, { piiValues: 'not-json' }).ok, false);
});

test('secret scrubber fails closed on unsupported payload types', () => {
  const result = scrubSensitiveData({ value: BigInt(1) });
  assert.equal(result.ok, false);
});

test('memory ingestion scrubs secrets and PII before persistence and marks provenance untrusted', async () => {
  const db = new MemoryD1();
  const response = await onRequestPost({
    request: await ownerRequest(memoryInput),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 201);
  assert.doesNotMatch(db.records[0].content, /abcdefghijklmnopqrstuvwxyz123456/);
  assert.doesNotMatch(db.records[0].source_attribution, /alex@example\.com/);
  const payload = await response.json();
  assert.equal(payload.memory.source.trust, 'untrusted');
  assert.equal(payload.memory.status, 'candidate');
});

test('memory ingestion rejects client-asserted trusted provenance', async () => {
  const db = new MemoryD1();
  const response = await onRequestPost({
    request: await ownerRequest({
      ...memoryInput,
      source: { ...memoryInput.source, type: 'system-observation' },
    }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 400);
  assert.equal(db.records.length, 0);
});
