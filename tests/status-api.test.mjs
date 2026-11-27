import test from 'node:test';
import assert from 'node:assert/strict';
import { createRevocableSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet } from '../functions/api/status.js';

const secret = 'test-only-status-api-secret-with-sufficient-entropy';
const sessions = new Map();
const env = {
  AEGIS_PASSWORD: 'test-only-bootstrap-password',
  AEGIS_SESSION_SECRET: secret,
  AEGIS_DB: {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            first: async () => {
              if (sql.includes('FROM auth_sessions')) {
                const row = sessions.get(values[0]);
                return row && row.expires_at > values[1]
                  ? { session_id: values[0], ...row }
                  : null;
              }
              if (sql.includes('FROM system_state')) {
                return {
                  operational_mode: 'NORMAL',
                  threat_level: 'LOW',
                  eve_state_tag: 'IDLE',
                  updated_at: '2026-11-26T00:00:00.000Z',
                };
              }
              return null;
            },
          };
        },
      };
    },
  },
};

test('status API rejects requests without a valid session', async () => {
  const response = await onRequestGet({
    request: new Request('https://aegis.example/api/status'),
    env,
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('Cache-Control'), 'no-store, no-cache, must-revalidate');
});

test('status API returns internal operational state only to an authenticated session', async () => {
  const session = await createRevocableSessionToken(secret);
  sessions.set(session.sessionId, {
    expires_at: session.expiresAt,
    revoked_at: null,
    principal_id: 'usr-root',
    tenant_id: 'org-root',
    roles_json: '["owner"]',
  });
  const response = await onRequestGet({
    request: new Request('https://aegis.example/api/status', {
      headers: { Cookie: '__Host-aegis_session=' + session.token },
    }),
    env,
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.system_state.threat_level, 'LOW');
  assert.equal(body.system_state.eve_state_tag, 'IDLE');
});
