import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompanionModelLifecycle } from '../companion/model-lifecycle.mjs';

function model(name, disposed = []) {
  return { name, dispose() { disposed.push(name); } };
}

test('prepare keeps the active model until a candidate is explicitly committed', async () => {
  const disposed = [];
  const lifecycle = createCompanionModelLifecycle();
  const first = model('first', disposed);
  const second = model('second', disposed);

  const initial = await lifecycle.prepare(async () => first);
  assert.equal(initial.prepared, true);
  assert.equal(lifecycle.active, null);
  assert.equal((await lifecycle.commit(initial.ticket)).committed, true);
  assert.equal(lifecycle.active, first);

  const candidate = await lifecycle.prepare(async () => second);
  assert.equal(candidate.prepared, true);
  assert.equal(lifecycle.active, first);
  assert.deepEqual(disposed, []);

  const committed = await lifecycle.commit(candidate.ticket);
  assert.equal(committed.committed, true);
  assert.equal(lifecycle.active, second);
  assert.deepEqual(disposed, ['first']);
});

test('failed preparation preserves the active model and reports a safe failure', async () => {
  const lifecycle = createCompanionModelLifecycle();
  const active = model('active');
  const ready = await lifecycle.prepare(async () => active);
  await lifecycle.commit(ready.ticket);

  const failed = await lifecycle.prepare(async () => { throw new Error('parser failure'); });
  assert.deepEqual(failed, { prepared: false, reason: 'prepare-failed' });
  assert.equal(lifecycle.active, active);
});

test('destroy disposes active and prepared models exactly once and is idempotent', async () => {
  const disposed = [];
  const lifecycle = createCompanionModelLifecycle();
  const active = model('active', disposed);
  const pending = model('pending', disposed);
  const ready = await lifecycle.prepare(async () => active);
  await lifecycle.commit(ready.ticket);
  const candidate = await lifecycle.prepare(async () => pending);

  assert.deepEqual(await lifecycle.destroy(), { destroyed: true, disposedCount: 2 });
  assert.deepEqual(await lifecycle.destroy(), { destroyed: true, disposedCount: 0 });
  assert.deepEqual(disposed.sort(), ['active', 'pending']);
  assert.equal(lifecycle.active, null);
  assert.equal((await lifecycle.commit(candidate.ticket)).reason, 'destroyed');
});

test('a candidate resolving after destroy is immediately disposed and never committed', async () => {
  const disposed = [];
  const lifecycle = createCompanionModelLifecycle();
  let resolveCandidate;
  const pending = lifecycle.prepare(() => new Promise(resolve => { resolveCandidate = resolve; }));

  await lifecycle.destroy();
  const lateModel = model('late', disposed);
  resolveCandidate(lateModel);

  assert.deepEqual(await pending, { prepared: false, reason: 'destroyed' });
  assert.deepEqual(disposed, ['late']);
  assert.equal(lifecycle.active, null);
});

test('unknown tickets, invalid loaders and invalid model values fail closed', async () => {
  const lifecycle = createCompanionModelLifecycle();
  assert.deepEqual(await lifecycle.prepare(null), { prepared: false, reason: 'invalid-loader' });
  assert.deepEqual(await lifecycle.prepare(async () => null), { prepared: false, reason: 'invalid-model' });
  assert.deepEqual(await lifecycle.commit({}), { committed: false, reason: 'unknown-ticket' });
});

test('disposal errors do not roll back a committed replacement or prevent remaining cleanup', async () => {
  const disposed = [];
  const lifecycle = createCompanionModelLifecycle();
  const first = { dispose() { disposed.push('first'); throw new Error('cleanup failed'); } };
  const second = model('second', disposed);
  const one = await lifecycle.prepare(async () => first);
  await lifecycle.commit(one.ticket);
  const two = await lifecycle.prepare(async () => second);

  const replacement = await lifecycle.commit(two.ticket);
  assert.equal(replacement.committed, true);
  assert.equal(replacement.previousDisposalFailed, true);
  assert.equal(lifecycle.active, second);
  assert.deepEqual(await lifecycle.destroy(), { destroyed: true, disposedCount: 1 });
  assert.deepEqual(disposed, ['first', 'second']);
});
