import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createForgeKnowledgeRecord,
  getForgeKnowledgeRecord,
  listForgeKnowledgeRecords,
  listForgeKnowledgeEvents,
  updateForgeKnowledgeReview,
  ForgeKnowledgeConflictError,
} from '../functions/lib/forge-knowledge.mjs';

class KnowledgeD1 {
  constructor() {
    this.records = new Map();
    this.events = [];
  }

  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async first() {
        if (sql.includes('FROM forge_knowledge_records WHERE id = ? AND owner_id = ?')) {
          const [id, ownerId] = this.values;
          const row = db.records.get(id);
          return row?.owner_id === ownerId ? { ...row } : null;
        }
        return null;
      },
      async all() {
        if (sql.includes('FROM forge_knowledge_events')) {
          const [recordId, ownerId, limit] = this.values;
          return {
            results: db.events
              .filter(event => event.record_id === recordId && event.owner_id === ownerId)
              .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || b.id.localeCompare(a.id))
              .slice(0, limit)
              .map(event => ({ ...event })),
          };
        }
        if (sql.includes('FROM forge_knowledge_records')) {
          const [ownerId, status, , domain, , knowledgeType, , query, , , , limit] = this.values;
          return {
            results: [...db.records.values()]
              .filter(row => row.owner_id === ownerId)
              .filter(row => status === 'all' || row.status === status)
              .filter(row => domain === null || row.domain === domain)
              .filter(row => knowledgeType === null || row.knowledge_type === knowledgeType)
              .filter(row => !query || [row.title, row.summary, row.domain, row.sources_json]
                .some(value => value.toLowerCase().includes(query.toLowerCase())))
              .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id))
              .slice(0, limit)
              .map(row => ({ ...row })),
          };
        }
        return { results: [] };
      },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO forge_knowledge_records')) {
          const [
            id, ownerId, title, domain, knowledgeType, summary, evidenceLevel,
            status, sourcesJson, limitationsJson, capabilitiesJson, createdAt, updatedAt,
          ] = v;
          if (db.records.has(id)) return { meta: { changes: 0 } };
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
          const [
            status, reviewNote, reviewerId, updatedAt, reviewedAt,
            acceptedAt, supersededAt, id, ownerId, expectedUpdatedAt, oldStatus,
          ] = v;
          const row = db.records.get(id);
          if (!row || row.owner_id !== ownerId || row.updated_at !== expectedUpdatedAt ||
              row.status !== oldStatus) return { meta: { changes: 0 } };
          const fromStatus = row.status;
          row.status = status;
          row.review_note = reviewNote;
          row.reviewer_id = reviewerId;
          row.updated_at = updatedAt;
          row.version += 1;
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
    };
  }
}

const input = {
  title: 'Reliable coding agent evaluation',
  domain: 'coding-agents',
  knowledgeType: 'benchmark',
  summary: 'Evaluate coding agents against reproducible repository tasks and regression suites.',
  evidenceLevel: 'high',
  sources: [{
    url: 'https://example.org/paper',
    title: 'Evaluation paper',
    attribution: 'Example authors, 2026',
  }],
  limitations: ['Benchmark scores do not guarantee production reliability'],
  applicableCapabilities: ['benchmark.compare', 'code.test'],
};

test('creates owner-scoped draft knowledge and excludes it from accepted search', async () => {
  const db = new KnowledgeD1();
  const record = await createForgeKnowledgeRecord(db, 'owner', input, Date.parse('2026-11-16T12:00:00.000Z'));
  assert.equal(record.status, 'draft');
  assert.equal(record.version, 1);
  assert.equal(record.ownerId, 'owner');
  assert.equal((await getForgeKnowledgeRecord(db, 'owner', record.id)).id, record.id);
  assert.deepEqual(await listForgeKnowledgeRecords(db, 'owner'), []);
  const all = await listForgeKnowledgeRecords(db, 'owner', { status: 'all' });
  assert.equal(all.length, 1);
  assert.equal(all[0].title, input.title);
});

test('requires an explicit review transition before knowledge becomes searchable', async () => {
  const db = new KnowledgeD1();
  const created = await createForgeKnowledgeRecord(db, 'owner', input, Date.parse('2026-11-16T12:00:00.000Z'));
  await assert.rejects(() => updateForgeKnowledgeReview(db, 'owner', created.id, {
    status: 'accepted',
    reviewNote: 'Accept this without review.',
    expectedUpdatedAt: created.updatedAt,
  }), TypeError);

  const reviewed = await updateForgeKnowledgeReview(db, 'owner', created.id, {
    status: 'reviewed',
    reviewNote: 'I checked the source, method and stated limitations.',
    expectedUpdatedAt: created.updatedAt,
  }, Date.parse('2026-11-16T12:05:00.000Z'));
  assert.equal(reviewed.status, 'reviewed');
  assert.equal(reviewed.reviewerId, 'owner');

  const accepted = await updateForgeKnowledgeReview(db, 'owner', created.id, {
    status: 'accepted',
    reviewNote: 'Evidence is reproducible and suitable for internal reference.',
    expectedUpdatedAt: reviewed.updatedAt,
  }, Date.parse('2026-11-16T12:10:00.000Z'));
  assert.equal(accepted.status, 'accepted');
  assert.equal(accepted.version, 3);
  const results = await listForgeKnowledgeRecords(db, 'owner', { query: 'reproducible' });
  assert.equal(results.length, 1);
  assert.deepEqual(
    (await listForgeKnowledgeEvents(db, 'owner', created.id)).map(event => event.eventType),
    ['accepted', 'reviewed', 'created'],
  );
});

test('rejects low-evidence acceptance and stale review updates', async () => {
  const db = new KnowledgeD1();
  const low = await createForgeKnowledgeRecord(db, 'owner', { ...input, evidenceLevel: 'experimental' });
  const reviewed = await updateForgeKnowledgeReview(db, 'owner', low.id, {
    status: 'reviewed',
    reviewNote: 'Reviewed, but evidence remains experimental.',
    expectedUpdatedAt: low.updatedAt,
  });
  await assert.rejects(() => updateForgeKnowledgeReview(db, 'owner', low.id, {
    status: 'accepted',
    reviewNote: 'Accept the experimental finding.',
    expectedUpdatedAt: reviewed.updatedAt,
  }), TypeError);
  await assert.rejects(() => updateForgeKnowledgeReview(db, 'owner', low.id, {
    status: 'accepted',
    reviewNote: 'Evidence has improved, accept now.',
    expectedUpdatedAt: low.updatedAt,
  }), ForgeKnowledgeConflictError);
});

test('supersedes accepted knowledge without deleting its history', async () => {
  const db = new KnowledgeD1();
  const draft = await createForgeKnowledgeRecord(db, 'owner', input);
  const reviewed = await updateForgeKnowledgeReview(db, 'owner', draft.id, {
    status: 'reviewed', reviewNote: 'Source and limitations checked carefully.',
    expectedUpdatedAt: draft.updatedAt,
  });
  const accepted = await updateForgeKnowledgeReview(db, 'owner', draft.id, {
    status: 'accepted', reviewNote: 'Accepted for future AEGIS reference.',
    expectedUpdatedAt: reviewed.updatedAt,
  });
  const superseded = await updateForgeKnowledgeReview(db, 'owner', draft.id, {
    status: 'superseded', reviewNote: 'Superseded by a newer evidence record.',
    expectedUpdatedAt: accepted.updatedAt,
  });
  assert.equal(superseded.status, 'superseded');
  assert.equal((await listForgeKnowledgeRecords(db, 'owner')).length, 0);
  assert.equal((await listForgeKnowledgeRecords(db, 'owner', { status: 'all' })).length, 1);
  assert.equal((await listForgeKnowledgeEvents(db, 'owner', draft.id)).length, 4);
});

test('rejects malformed knowledge sources and non-owner reads', async () => {
  const db = new KnowledgeD1();
  await assert.rejects(() => createForgeKnowledgeRecord(db, 'owner', {
    ...input,
    sources: [{ url: 'javascript:alert(1)', title: 'Bad source', attribution: 'Unknown' }],
  }), TypeError);
  const record = await createForgeKnowledgeRecord(db, 'owner', input);
  assert.equal(await getForgeKnowledgeRecord(db, 'other-owner', record.id), null);
  assert.deepEqual(await listForgeKnowledgeRecords(db, 'other-owner', { status: 'all' }), []);
});
