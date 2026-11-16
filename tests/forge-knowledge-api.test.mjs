import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet as listKnowledge, onRequestPost as createKnowledge } from '../functions/api/forge/knowledge.js';
import { onRequestGet as getKnowledge, onRequestPatch as reviewKnowledge } from '../functions/api/forge/knowledge/[id].js';
import { onRequestGet as getKnowledgeEvents } from '../functions/api/forge/knowledge/[id]/events.js';

const secret = 'forge-knowledge-api-test-session-secret-long-enough';
const envBase = { AEGIS_PASSWORD: 'test-password-long-enough', AEGIS_SESSION_SECRET: secret };

class KnowledgeApiD1 {
  constructor() { this.records = new Map(); this.events = []; }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO forge_knowledge_records')) {
          const [id, ownerId, title, domain, knowledgeType, summary, evidenceLevel,
            status, sourcesJson, limitationsJson, capabilitiesJson, createdAt, updatedAt] = v;
          const row = {
            id, owner_id: ownerId, title, domain, knowledge_type: knowledgeType,
            summary, evidence_level: evidenceLevel, status,
            sources_json: sourcesJson, limitations_json: limitationsJson,
            applicable_capabilities_json: capabilitiesJson,
            review_note: null, reviewer_id: null, version: 1,
            created_at: createdAt, updated_at: updatedAt,
            reviewed_at: null, accepted_at: null, superseded_at: null,
          };
          db.records.set(id, row);
          db.events.push({
            id: 'event-' + db.events.length, record_id: id, owner_id: ownerId,
            event_type: 'created', from_status: null, to_status: status,
            detail_json: '{}', occurred_at: createdAt,
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('UPDATE forge_knowledge_records')) {
          const [status, reviewNote, reviewerId, updatedAt, _r, reviewedAt, _a, acceptedAt,
            _s, supersededAt, id, ownerId, expectedUpdatedAt, oldStatus] = v;
          const row = db.records.get(id);
          if (!row || row.owner_id !== ownerId || row.updated_at !== expectedUpdatedAt ||
              row.status !== oldStatus) return { meta: { changes: 0 } };
          const fromStatus = row.status;
          row.status = status; row.review_note = reviewNote; row.reviewer_id = reviewerId;
          row.updated_at = updatedAt; row.version += 1;
          if (status === 'reviewed') row.reviewed_at = reviewedAt;
          if (status === 'accepted') row.accepted_at = acceptedAt;
          if (status === 'superseded') row.superseded_at = supersededAt;
          db.events.push({
            id: 'event-' + db.events.length, record_id: id, owner_id: ownerId,
            event_type: status, from_status: fromStatus, to_status: status,
            detail_json: JSON.stringify({ reviewNote, reviewerId }), occurred_at: updatedAt,
          });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const [id, ownerId] = this.values;
        if (sql.includes('FROM forge_knowledge_records WHERE id = ? AND owner_id = ?')) {
          const row = db.records.get(id);
          return row?.owner_id === ownerId ? { ...row } : null;
        }
        return null;
      },
      async all() {
        const v = this.values;
        if (sql.includes('FROM forge_knowledge_events')) {
          const [recordId, ownerId, limit] = v;
          return { results: db.events
            .filter(event => event.record_id === recordId && event.owner_id === ownerId)
            .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || b.id.localeCompare(a.id))
            .slice(0, limit).map(event => ({ ...event })) };
        }
        if (sql.includes('FROM forge_knowledge_records')) {
          const ownerId = v[0], status = v[1], domain = v[3], type = v[5], query = v[7], limit = v[12];
          return { results: [...db.records.values()]
            .filter(row => row.owner_id === ownerId)
            .filter(row => status === 'all' || row.status === status)
            .filter(row => domain === null || row.domain === domain)
            .filter(row => type === null || row.knowledge_type === type)
            .filter(row => !query || [row.title, row.summary, row.domain, row.sources_json]
              .some(value => value.toLowerCase().includes(query.toLowerCase())))
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id))
            .slice(0, limit).map(row => ({ ...row })) };
        }
        return { results: [] };
      },
    };
  }
}

async function request(path, body, { authenticated = true, origin = 'https://aegis.example', method } = {}) {
  const headers = { 'Content-Type': 'application/json', Origin: origin };
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
  return new Request('https://aegis.example' + path, {
    method: method || (body === undefined ? 'GET' : 'POST'),
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const input = {
  title: 'Reliable coding agent evaluation',
  domain: 'coding-agents',
  knowledgeType: 'benchmark',
  summary: 'Evaluate coding agents against reproducible repository tasks.',
  evidenceLevel: 'high',
  sources: [{ url: 'https://example.org/paper', title: 'Evaluation paper', attribution: 'Example authors' }],
  limitations: ['Benchmark scores do not guarantee production reliability'],
  applicableCapabilities: ['benchmark.compare', 'code.test'],
};

test('Knowledge Library requires an owner session and same-origin writes', async () => {
  const unauth = await listKnowledge({
    request: await request('/api/forge/knowledge', undefined, { authenticated: false }),
    env: { ...envBase, AEGIS_DB: new KnowledgeApiD1() },
  });
  assert.equal(unauth.status, 401);
  const cross = await createKnowledge({
    request: await request('/api/forge/knowledge', input, { origin: 'https://attacker.example' }),
    env: { ...envBase, AEGIS_DB: new KnowledgeApiD1() },
  });
  assert.equal(cross.status, 403);
});

test('Knowledge Library creates drafts, requires explicit review, and searches accepted records', async () => {
  const db = new KnowledgeApiD1();
  const created = await createKnowledge({
    request: await request('/api/forge/knowledge', input),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(created.status, 201);
  const draft = (await created.json()).record;
  assert.equal(draft.status, 'draft');

  const defaultList = await listKnowledge({
    request: await request('/api/forge/knowledge'),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal((await defaultList.json()).total, 0);

  const allList = await listKnowledge({
    request: await request('/api/forge/knowledge?status=all'),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal((await allList.json()).total, 1);

  const reviewedResponse = await reviewKnowledge({
    request: await request('/api/forge/knowledge/' + draft.id, {
      status: 'reviewed',
      reviewNote: 'Checked the source, evidence and limitations carefully.',
      expectedUpdatedAt: draft.updatedAt,
    }, { method: 'PATCH' }),
    env: { ...envBase, AEGIS_DB: db },
    params: { id: draft.id },
  });
  assert.equal(reviewedResponse.status, 200);
  const reviewed = (await reviewedResponse.json()).record;

  const acceptedResponse = await reviewKnowledge({
    request: await request('/api/forge/knowledge/' + draft.id, {
      status: 'accepted',
      reviewNote: 'Evidence is reproducible and useful for internal reference.',
      expectedUpdatedAt: reviewed.updatedAt,
    }, { method: 'PATCH' }),
    env: { ...envBase, AEGIS_DB: db },
    params: { id: draft.id },
  });
  assert.equal(acceptedResponse.status, 200);
  const accepted = (await acceptedResponse.json()).record;
  assert.equal(accepted.status, 'accepted');

  const search = await listKnowledge({
    request: await request('/api/forge/knowledge?q=reproducible&domain=coding-agents'),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal((await search.json()).total, 1);

  const detail = await getKnowledge({
    request: await request('/api/forge/knowledge/' + draft.id),
    env: { ...envBase, AEGIS_DB: db },
    params: { id: draft.id },
  });
  assert.equal((await detail.json()).record.status, 'accepted');

  const history = await getKnowledgeEvents({
    request: await request('/api/forge/knowledge/' + draft.id + '/events'),
    env: { ...envBase, AEGIS_DB: db },
    params: { id: draft.id },
  });
  assert.deepEqual((await history.json()).events.map(event => event.eventType), [
    'accepted', 'reviewed', 'created',
  ]);
});

test('Knowledge Library rejects client-supplied status, unknown fields and repeated search parameters', async () => {
  const db = new KnowledgeApiD1();
  const invalidCreate = await createKnowledge({
    request: await request('/api/forge/knowledge', { ...input, status: 'accepted' }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(invalidCreate.status, 400);
  const repeated = await listKnowledge({
    request: await request('/api/forge/knowledge?status=accepted&status=all'),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(repeated.status, 400);
  const invalidPatch = await reviewKnowledge({
    request: await request('/api/forge/knowledge/knowledge-test', {
      status: 'accepted', reviewNote: 'Skip review please.', expectedUpdatedAt: new Date().toISOString(),
      reviewerId: 'admin',
    }, { method: 'PATCH' }),
    env: { ...envBase, AEGIS_DB: db },
    params: { id: 'knowledge-test' },
  });
  assert.equal(invalidPatch.status, 400);
});
