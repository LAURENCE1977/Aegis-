import test from 'node:test';
import assert from 'node:assert/strict';
import { createRevocableSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet } from '../functions/api/memories.js';

const sessionSecret = 'memory-pagination-api-session-secret-with-enough-entropy';
const cursorSecret = 'memory-pagination-api-cursor-secret-with-enough-entropy';
const sessions = new Map();

class PaginationD1 {
  constructor(rows = []) {
    this.rows = rows;
    this.memoryReads = 0;
  }
  prepare(sql) {
    if (sql.includes('FROM auth_sessions')) {
      return { bind: (sid, now) => ({ first: async () => {
        const row = sessions.get(sid);
        return row && row.expires_at > now && !row.revoked_at ? { session_id: sid, ...row } : null;
      } }) };
    }
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async first() { return null; },
      async all() {
        if (!sql.includes('FROM aegis_memories')) return { results: [] };
        this.db.memoryReads += 1;
        const v = this.values;
        const [tenantId, principalId, projectId, nowIso] = v;
        let rows = this.db.rows.filter(row =>
          row.tenant_id === tenantId && row.principal_id === principalId &&
          row.project_id === projectId && ['accepted', ...(sql.includes("'candidate'") ? ['candidate'] : [])].includes(row.status) &&
          (!row.expires_at || row.expires_at > nowIso)
        );
        if (sql.includes('updated_at < ?')) {
          const [cursorUpdatedAt, tieUpdatedAt, cursorId] = v.slice(4, 7);
          rows = rows.filter(row => row.updated_at < cursorUpdatedAt ||
            (row.updated_at === tieUpdatedAt && row.id > cursorId));
        }
        rows.sort((a,b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id));
        return { results: rows.slice(0, v[v.length - 1]).map(row => ({...row})) };
      },
      db: this,
    };
  }
}

function row(id, updatedAt = '2026-11-26T19:00:00.000Z', overrides = {}) {
  return {
    id, owner_id:'usr-root', principal_id:'usr-root', tenant_id:'org-root', project_id:null,
    supersedes_id:null, kind:'fact', content:'pagination fixture '+id,
    source_type:'user-stated', source_url:'https://aegis.example/source',
    source_attribution:'pagination test', source_observed_at:'2026-11-26T18:00:00.000Z',
    confidence:1, sensitivity:'private', status:'accepted', tags_json:'[]',
    created_at:'2026-11-26T18:00:00.000Z', updated_at:updatedAt, expires_at:null,
    ...overrides,
  };
}

async function authenticatedRequest(path, principalId = 'usr-root', tenantId = 'org-root') {
  const session = await createRevocableSessionToken(sessionSecret);
  sessions.set(session.sessionId, {
    expires_at:session.expiresAt, revoked_at:null, principal_id:principalId,
    tenant_id:tenantId, roles_json:'["owner"]',
  });
  return new Request('https://aegis.example'+path, {
    headers:{ Cookie:'__Host-aegis_session='+session.token },
  });
}

function env(db, secret) {
  if (arguments.length < 2) secret = cursorSecret;
  return {
    AEGIS_PASSWORD:'test-password-long-enough',
    AEGIS_SESSION_SECRET:sessionSecret,
    AEGIS_DB:db,
    ...(typeof secret === 'string' ? { CURSOR_SIGNING_SECRET:secret } : {}),
  };
}

test('memory pagination advances in updated_at DESC, id ASC order without gaps', async () => {
  const db = new PaginationD1([
    row('memory-a'), row('memory-b'), row('memory-c'),
    row('memory-d','2026-11-25T19:00:00.000Z'),
  ]);
  const first = await onRequestGet({
    request:await authenticatedRequest('/api/memories?limit=2'),
    env:env(db),
  });
  assert.equal(first.status,200,await first.clone().text());
  const firstBody = await first.json();
  assert.deepEqual(firstBody.memories.map(item=>item.id),['memory-a','memory-b']);
  assert.equal(firstBody.total,2);
  assert.equal(firstBody.has_more,true);
  assert.equal(typeof firstBody.next_cursor,'string');

  const second = await onRequestGet({
    request:await authenticatedRequest('/api/memories?limit=2&cursor='+encodeURIComponent(firstBody.next_cursor)),
    env:env(db),
  });
  assert.equal(second.status,200);
  const secondBody = await second.json();
  assert.deepEqual(secondBody.memories.map(item=>item.id),['memory-c','memory-d']);
  assert.equal(secondBody.has_more,false);
  assert.equal(secondBody.next_cursor,null);
});

test('memory pagination rejects a cursor replayed across principals before reading memories', async () => {
  const db = new PaginationD1([row('memory-a'),row('memory-b')]);
  const first = await onRequestGet({
    request:await authenticatedRequest('/api/memories?limit=1'),
    env:env(db),
  });
  const cursor = (await first.json()).next_cursor;
  const readsBefore = db.memoryReads;
  const replay = await onRequestGet({
    request:await authenticatedRequest('/api/memories?limit=1&cursor='+encodeURIComponent(cursor),'usr-other','org-other'),
    env:env(db),
  });
  assert.equal(replay.status,400);
  assert.equal(db.memoryReads,readsBefore);
});

test('memory pagination rejects cursor use with relevance search before reading memories', async () => {
  const db = new PaginationD1([row('memory-a'),row('memory-b')]);
  const response = await onRequestGet({
    request:await authenticatedRequest('/api/memories?q=memory&cursor=not-a-cursor'),
    env:env(db),
  });
  assert.equal(response.status,400);
  assert.equal(db.memoryReads,0);
});

test('memory pagination fails closed when more rows exist but signing secret is absent', async () => {
  const db = new PaginationD1([row('memory-a'),row('memory-b')]);
  const response = await onRequestGet({
    request:await authenticatedRequest('/api/memories?limit=1'),
    env:env(db,null),
  });
  assert.equal(response.status,503);
});

test('memory pagination preserves review and project scope in signed cursors', async () => {
  const db = new PaginationD1([
    row('candidate-a','2026-11-26T19:00:00.000Z',{status:'candidate'}),
    row('candidate-b','2026-11-25T19:00:00.000Z',{status:'candidate'}),
  ]);
  const first = await onRequestGet({
    request:await authenticatedRequest('/api/memories?review=1&limit=1'),
    env:env(db),
  });
  assert.equal(first.status,200);
  const cursor=(await first.json()).next_cursor;
  const mismatch = await onRequestGet({
    request:await authenticatedRequest('/api/memories?review=0&limit=1&cursor='+encodeURIComponent(cursor)),
    env:env(db),
  });
  assert.equal(mismatch.status,400);
});
