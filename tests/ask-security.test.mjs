import test from 'node:test';
import assert from 'node:assert/strict';
import { createRevocableSessionToken } from '../functions/lib/auth.mjs';
import { withAegisImmunePipeline } from '../functions/lib/membrane/pipeline.mjs';
import { onRequestPost as askPost } from '../functions/api/ask.js';

test('ask scrubs PII and secrets from question, history and configured private values before provider dispatch', async () => {
  const secret = 'ask-security-test-session-secret-with-entropy';
  const { token, sessionId } = await createRevocableSessionToken(secret);
  let providerMessages;
  const env = {
    AEGIS_PASSWORD: 'test-password-long-enough',
    AEGIS_SESSION_SECRET: secret,
    AEGIS_PII_VALUES: ['PrivateCode-9921'],
    AEGIS_DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return {
              first: async () => sql.includes('FROM auth_sessions') && values[0] === sessionId
                ? { session_id: sessionId }
                : null,
              all: async () => ({ results: [] }),
            };
          },
        };
      },
    },
    AI: {
      run: async (_model, input) => {
        providerMessages = input.messages;
        return { response: 'ok' };
      },
    },
  };
  const request = new Request('https://aegis.test/api/ask', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://aegis.test',
      cookie: '__Host-aegis_session=' + token,
    },
    body: JSON.stringify({
      question: 'Contact owner@example.com using key sk-abcdefghijklmnop and code PrivateCode-9921',
      history: [{ role: 'user', content: 'Call +1 415 555 0123 about the account.' }],
    }),
  });
  const response = await withAegisImmunePipeline({
    request,
    next: forwarded => askPost({ request: forwarded, env }),
  });
  assert.equal(response.status, 200);
  const serialized = JSON.stringify(providerMessages);
  assert.match(serialized, /REDACTED_EMAIL/);
  assert.match(serialized, /REDACTED_TOKEN/);
  assert.match(serialized, /REDACTED_PHONE/);
  assert.match(serialized, /REDACTED_CONFIGURED_PII/);
  assert.doesNotMatch(serialized, /owner@example\.com|sk-abcdefghijklmnop|PrivateCode-9921|415 555 0123/);
});
