import test from 'node:test';
import assert from 'node:assert/strict';
import {
  registerEvaluationSuite,
  listEvaluationSuites,
} from '../functions/lib/eval-forge-store.mjs';

class EvalSuiteD1 {
  constructor() { this.rows = new Map(); this.events = []; }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        if (sql.includes('INSERT INTO eval_suites')) {
          const [id, owner, suiteId, version, digest, json, createdAt] = this.values;
          const key = owner + '|' + suiteId + '|' + version;
          if (db.rows.has(key)) return { meta: { changes: 0 } };
          const row = { id, owner_id: owner, suite_id: suiteId, version, suite_digest: digest, suite_json: json, created_at: createdAt };
          db.rows.set(key, row);
          db.events.push({ owner_id: owner, suite_id: suiteId, version, event_type: 'registered' });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const [owner, suiteId, version] = this.values;
        return db.rows.get(owner + '|' + suiteId + '|' + version) ?? null;
      },
      async all() {
        const [owner, limit] = this.values;
        return { results: [...db.rows.values()].filter(row => row.owner_id === owner)
          .sort((a,b) => b.created_at.localeCompare(a.created_at) || a.suite_id.localeCompare(b.suite_id))
          .slice(0, limit) };
      },
    };
  }
}

const suite = () => ({
  id: 'guardian-regression',
  version: '1.0.0',
  title: 'Guardian regression suite',
  taskType: 'reasoning',
  minimumScore: 100,
  cases: [
    { id: 'scope-check', weight: 1, required: true },
    { id: 'evidence-check', weight: 2, required: true },
  ],
});

test('registers immutable owner-scoped suite versions with a content digest and audit event', async () => {
  const db = new EvalSuiteD1();
  const first = await registerEvaluationSuite(db, 'owner', suite(), Date.parse('2026-11-17T12:00:00.000Z'));
  assert.equal(first.created, true);
  assert.equal(first.suite.id, 'guardian-regression');
  assert.equal(first.suite.version, '1.0.0');
  assert.match(first.digest, /^[a-f0-9]{64}$/);
  assert.equal(db.events.length, 1);
  assert.equal(db.events[0].event_type, 'registered');
});

test('registration is idempotent for equivalent suite JSON independent of object key order', async () => {
  const db = new EvalSuiteD1();
  const first = await registerEvaluationSuite(db, 'owner', suite());
  const reordered = {
    cases: suite().cases,
    minimumScore: 100,
    taskType: 'reasoning',
    title: 'Guardian regression suite',
    version: '1.0.0',
    id: 'guardian-regression',
  };
  const second = await registerEvaluationSuite(db, 'owner', reordered);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.digest, first.digest);
  assert.equal(db.rows.size, 1);
  assert.equal(db.events.length, 1);
});

test('rejects attempts to replace an existing suite version with different content', async () => {
  const db = new EvalSuiteD1();
  await registerEvaluationSuite(db, 'owner', suite());
  const changed = suite();
  changed.minimumScore = 90;
  await assert.rejects(registerEvaluationSuite(db, 'owner', changed), /already exists with different content/i);
  assert.equal(db.rows.size, 1);
  assert.equal(db.events.length, 1);
});

test('suite versions and listings are isolated by owner and bounded', async () => {
  const db = new EvalSuiteD1();
  await registerEvaluationSuite(db, 'owner', suite());
  await registerEvaluationSuite(db, 'another-owner', { ...suite(), title: 'Other owner suite' });
  const records = await listEvaluationSuites(db, 'owner', 10);
  assert.equal(records.length, 1);
  assert.equal(records[0].ownerId, 'owner');
  await assert.rejects(listEvaluationSuites(db, 'owner', 101), /limit/i);
});

test('rejects malformed owner, invalid suite and non-finite clock before persistence', async () => {
  const db = new EvalSuiteD1();
  await assert.rejects(registerEvaluationSuite(db, '../owner', suite()), /owner/i);
  await assert.rejects(registerEvaluationSuite(db, 'owner', { ...suite(), minimumScore: 101 }), /minimum score/i);
  await assert.rejects(registerEvaluationSuite(db, 'owner', suite(), Number.NaN), /clock/i);
  assert.equal(db.rows.size, 0);
});
