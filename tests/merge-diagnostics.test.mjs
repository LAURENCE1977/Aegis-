import test from 'node:test';
import assert from 'node:assert/strict';
import { collectMergeSnapshot, renderMergeSummary, selectMergeStack } from '../functions/lib/merge-diagnostics.mjs';

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

test('preserves GitHub pending mergeability and normalizes missing file lists', async () => {
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

  assert.equal(result[0].mergeable, null);
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

test('limits concurrent GitHub metadata requests to protect API rate limits', async () => {
  const pullRequests = Array.from({ length: 12 }, (_, index) => openPr({
    number: 400 + index,
    base: { ref: 'main', sha: 'base-sha' },
    head: { ref: `feature/${index}`, label: `owner:feature/${index}`, sha: 'head-sha' },
  }));
  let active = 0;
  let maximum = 0;
  const fetch = async () => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 2));
    active -= 1;
    return { status: 'ahead', ahead_by: 1, behind_by: 0, merge_base: { sha: 'base' } };
  };
  await collectMergeSnapshot(pullRequests, fetch, async () => []);
  assert.ok(maximum <= 4, `expected at most four concurrent requests, saw ${maximum}`);
});

test('selects the connected feature stack without pulling in unrelated main-branch PRs', async () => {
  const pullRequests = [
    openPr({ number: 501, base: { ref: 'feature/parent', sha: 'a' }, head: { ref: 'feature/current', label: 'owner:feature/current', sha: 'b' } }),
    openPr({ number: 502, base: { ref: 'feature/parent', sha: 'a' }, head: { ref: 'feature/sibling', label: 'owner:feature/sibling', sha: 'c' } }),
    openPr({ number: 503, base: { ref: 'main', sha: 'm' }, head: { ref: 'feature/unrelated', label: 'owner:feature/unrelated', sha: 'd' } }),
    openPr({ number: 504, base: { ref: 'feature/sibling', sha: 'c' }, head: { ref: 'feature/child', label: 'owner:feature/child', sha: 'e' } }),
  ];
  const selected = selectMergeStack(pullRequests, pullRequests[0], 'main');
  assert.deepEqual(selected.map(item => item.number), [501, 502, 504]);
});

test('does not use the default branch as a graph bridge between unrelated pull requests', () => {
  const current = openPr({
    number: 510,
    base: { ref: 'main', sha: 'main-sha' },
    head: { ref: 'feature/current', label: 'owner:feature/current', sha: 'head-sha' },
  });
  const unrelated = openPr({
    number: 511,
    base: { ref: 'main', sha: 'main-sha' },
    head: { ref: 'feature/other', label: 'owner:feature/other', sha: 'other-sha' },
  });
  assert.deepEqual(selectMergeStack([current, unrelated], current, 'main').map(item => item.number), [510]);
});

test('uses full pull-request details for mergeability instead of list-response omissions', async () => {
  const result = await collectMergeSnapshot(
    [openPr({ mergeable: undefined })],
    async () => ({ status: 'ahead', ahead_by: 1, behind_by: 0, merge_base: { sha: 'base' } }),
    async () => [],
    async () => ({ mergeable: true }),
  );
  assert.equal(result[0].mergeable, true);
});
