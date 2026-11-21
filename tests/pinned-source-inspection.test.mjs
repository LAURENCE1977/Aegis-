import test from 'node:test';
import assert from 'node:assert/strict';
import { createPinnedSourceInspection } from '../functions/lib/pinned-source-inspection.mjs';

const repository = {
  fullName: 'example/agent',
  sourceUrl: 'https://github.com/example/agent',
  licenseSpdx: 'MIT',
};
const commitSha = '1'.repeat(40);
const observedAt = '2026-11-21T09:00:00.000Z';
const files = [
  { path: 'README.md', sha: 'a'.repeat(40), size: 100 },
  { path: 'src/agent.ts', sha: 'b'.repeat(40), size: 200 },
];

test('creates a frozen source-inspection record pinned to a full commit SHA', () => {
  const result = createPinnedSourceInspection({ repository, commitSha, observedAt, files });
  assert.equal(result.schema, 'aegis.pinned-source-inspection.v1');
  assert.equal(result.repository.fullName, 'example/agent');
  assert.equal(result.commitSha, commitSha);
  assert.deepEqual(result.files, files);
  assert.equal(result.totalBytes, 300);
  assert.equal(result.trust.content, 'untrusted');
  assert.equal(result.execution.authorised, false);
  assert.equal(result.execution.install, false);
  assert.equal(result.execution.execute, false);
  assert.equal(result.sentinelApprovalRequired, true);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.files), true);
  assert.equal(Object.isFrozen(result.files[0]), true);
});

test('rejects a branch name or abbreviated commit instead of an immutable commit SHA', () => {
  assert.throws(() => createPinnedSourceInspection({ repository, commitSha: 'main', observedAt, files }), /commit SHA/i);
  assert.throws(() => createPinnedSourceInspection({ repository, commitSha: '1'.repeat(12), observedAt, files }), /commit SHA/i);
});

test('rejects non-canonical or mismatched repository identity', () => {
  assert.throws(() => createPinnedSourceInspection({
    repository: { ...repository, sourceUrl: 'https://github.com/other/repo' },
    commitSha, observedAt, files,
  }), /repository/i);
});

test('rejects unsafe paths, duplicate paths and malformed blob identifiers', () => {
  for (const file of [
    { path: '../secret.txt', sha: 'a'.repeat(40), size: 1 },
    { path: '/absolute.ts', sha: 'a'.repeat(40), size: 1 },
    { path: 'src\\\\agent.ts', sha: 'a'.repeat(40), size: 1 },
    { path: 'src/agent.ts', sha: 'a'.repeat(40), size: 1 },
  ]) {
    assert.throws(() => createPinnedSourceInspection({ repository, commitSha, observedAt, files: [file, file] }));
  }
  assert.throws(() => createPinnedSourceInspection({
    repository, commitSha, observedAt, files: [{ path: 'src/agent.ts', sha: 'not-a-sha', size: 1 }],
  }), /blob SHA/i);
});

test('enforces per-file, file-count and aggregate byte limits', () => {
  assert.throws(() => createPinnedSourceInspection({
    repository, commitSha, observedAt, files: [{ path: 'src/large.ts', sha: 'a'.repeat(40), size: 32769 }],
  }), /size/i);
  assert.throws(() => createPinnedSourceInspection({
    repository, commitSha, observedAt,
    files: Array.from({ length: 21 }, (_, index) => ({
      path: 'src/file' + index + '.ts', sha: (index + 1).toString(16).padStart(40, '0'), size: 1,
    })),
  }), /file count/i);
  assert.throws(() => createPinnedSourceInspection({
    repository, commitSha, observedAt,
    files: Array.from({ length: 9 }, (_, index) => ({
      path: 'src/file' + index + '.ts', sha: (index + 1).toString(16).padStart(40, '0'), size: 32768,
    })),
  }), /aggregate/i);
});

test('rejects future or invalid observation timestamps', () => {
  assert.throws(() => createPinnedSourceInspection({ repository, commitSha, observedAt: 'not-a-date', files }), /timestamp/i);
  assert.throws(() => createPinnedSourceInspection({
    repository, commitSha, observedAt: '2099-01-01T00:00:00.000Z', files,
  }), /future/i);
});

test('does not accept caller-supplied execution or trust overrides', () => {
  assert.throws(() => createPinnedSourceInspection({
    repository, commitSha, observedAt, files, execute: true,
  }), /unexpected/i);
});
