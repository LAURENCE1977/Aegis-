import test from 'node:test';
import assert from 'node:assert/strict';
import { collectMergeSnapshot, renderMergeSummary } from '../functions/lib/merge-diagnostics.mjs';

const openPr = (overrides = {}) => ({
  number: 301,
  title: 'Example change',
  html_url: 'https://github.com/example/repo/pull/301',
  state: 'open',
  draft: false,
  mergeable: true,
  base: { ref: 'main', sha: 'base-sha' },
  head: { ref: 'feature/example', label: 'owner:feature/example', sha: 'head-sha' },
  ...overrides,
});

test('collects compare metadata and changed paths for each open pull request', async () => {
  const result = await collectMergeSnapshot(
    [openPr()],
    async () => ({
      status: 'diverged',
      ahead_by: 2,
      behind_by: 4,
      merge_base: { sha: 'merge-base-sha' },
    }),
    async () => [{ filename: 'index.html' }, { filename: 'tests/ui.test.mjs' }],
  );

  assert.deepEqual(result, [{
    number: 301,
    title: 'Example change',
    url: 'https://github.com/example/repo/pull/301',
    base: 'main',
    head: 'feature/example',
    mergeable: true,
    compare: {
      status: 'diverged',
      aheadBy: 2,
      behindBy: 4,
      mergeBaseSha: 'merge-base-sha',
    },
    files: ['index.html', 'tests/ui.test.mjs'],
  }]);
});

test('keeps GitHub pending mergeability fail-closed and normalizes missing file lists', async () => {
  const result = await collectMergeSnapshot(
    [openPr({ mergeable: null })],
    async () => ({
      status: 'ahead',
      ahead_by: 1,
      behind_by: 0,
      merge_base: { sha: 'base-sha' },
    }),
    async () => [],
  );

  assert.equal(result[0].mergeable, false);
  assert.deepEqual(result[0].files, []);
});

test('renders a compact pull-request summary with drift and overlap warnings', () => {
  const markdown = renderMergeSummary({
    pullRequests: [
      {
        number: 301,
        recommendation: 'rebase_or_update_branch',
        baseDrift: { behindBy: 4 },
        overlappingPullRequests: [{ number: 302, files: ['index.html'] }],
      },
      {
        number: 302,
        recommendation: 'ready_for_review',
        baseDrift: { behindBy: 0 },
        overlappingPullRequests: [{ number: 301, files: ['index.html'] }],
      },
    ],
    mergeOrder: [301, 302],
  });

  assert.match(markdown, /#301/);
  assert.match(markdown, /4 commits behind/);
  assert.match(markdown, /#302/);
  assert.match(markdown, /index\.html/);
  assert.match(markdown, /Dependency review order:\*\* #301 → #302/);
});

test('renders a safe empty-state summary when there are no open pull requests', () => {
  assert.match(renderMergeSummary({ pullRequests: [], mergeOrder: [] }), /No open pull requests/);
});
