import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMergeReadiness } from '../functions/lib/merge-intelligence.mjs';

const pr = (overrides = {}) => ({
  number: 200,
  base: 'main',
  head: 'feature/example',
  mergeable: true,
  baseSha: 'base-current',
  headSha: 'head-current',
  compare: {
    status: 'ahead',
    aheadBy: 3,
    behindBy: 0,
    mergeBaseSha: 'base-current',
  },
  files: ['src/a.mjs'],
  ...overrides,
});

test('merge intelligence flags a branch that is behind its current base', () => {
  const result = analyzeMergeReadiness([
    pr({
      compare: {
        status: 'diverged',
        aheadBy: 4,
        behindBy: 7,
        mergeBaseSha: 'old-base',
      },
    }),
  ]);

  assert.equal(result.pullRequests[0].baseDrift.behindBy, 7);
  assert.equal(result.pullRequests[0].recommendation, 'rebase_or_update_branch');
  assert.equal(result.pullRequests[0].mergeable, true);
});

test('merge intelligence separates confirmed Git conflicts from overlapping-file risk', () => {
  const result = analyzeMergeReadiness([
    pr({ number: 201, files: ['index.html', 'tests/ui.test.mjs'] }),
    pr({ number: 202, files: ['index.html', 'functions/api/chat.js'] }),
    pr({ number: 203, mergeable: false, files: ['functions/api/chat.js'] }),
  ]);

  assert.deepEqual(result.overlaps, [
    { pullRequests: [201, 202], files: ['index.html'] },
    { pullRequests: [202, 203], files: ['functions/api/chat.js'] },
  ]);
  assert.equal(result.pullRequests.find(item => item.number === 203).recommendation, 'resolve_github_conflicts');
  assert.equal(result.pullRequests.find(item => item.number === 202).recommendation, 'review_overlapping_files');
});

test('merge intelligence identifies stacked pull-request dependencies by branch name', () => {
  const result = analyzeMergeReadiness([
    pr({ number: 210, base: 'main', head: 'feature/parent' }),
    pr({ number: 211, base: 'feature/parent', head: 'feature/child' }),
  ]);

  assert.equal(result.pullRequests.find(item => item.number === 211).dependsOn, 210);
  assert.deepEqual(result.mergeOrder, [210, 211]);
});

test('merge intelligence does not invent file conflicts when file lists are missing', () => {
  const result = analyzeMergeReadiness([
    pr({ number: 220, files: [] }),
    pr({ number: 221, files: [] }),
  ]);

  assert.deepEqual(result.overlaps, []);
  assert.equal(result.pullRequests.every(item => item.recommendation === 'ready_for_review'), true);
});

test('merge intelligence rejects malformed pull request metadata', () => {
  assert.throws(() => analyzeMergeReadiness([{ number: 1 }]), /pull request metadata/i);
});
