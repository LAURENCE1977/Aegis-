import test from 'node:test';
import assert from 'node:assert/strict';
import { collectMergeSnapshot, renderMergeSummary } from '../functions/lib/merge-diagnostics.mjs';
import { analyzeMergeReadiness } from '../functions/lib/merge-intelligence.mjs';

const pr = {
  number: 601,
  title: 'Pending mergeability',
  html_url: 'https://github.com/example/repo/pull/601',
  base: { ref: 'main', sha: 'base-sha' },
  head: { ref: 'feature/pending', label: 'owner:feature/pending', sha: 'head-sha' },
  mergeable: null,
};

test('preserves GitHub null mergeability instead of converting it into a confirmed conflict', async () => {
  const [item] = await collectMergeSnapshot(
    [pr],
    async () => ({ status: 'ahead', ahead_by: 1, behind_by: 0, merge_base: { sha: 'base-sha' } }),
    async () => [],
    async () => ({ mergeable: null }),
  );

  assert.equal(item.mergeable, null);
  const analysis = analyzeMergeReadiness([item]);
  assert.equal(analysis.pullRequests[0].recommendation, 'wait_for_github_mergeability');
});

test('renders pending mergeability as wait-and-refresh, not a conflict', () => {
  const markdown = renderMergeSummary({
    pullRequests: [{
      number: 601,
      recommendation: 'wait_for_github_mergeability',
      baseDrift: { behindBy: 0 },
      overlappingPullRequests: [],
    }],
    mergeOrder: [601],
  });

  assert.match(markdown, /wait for GitHub to finish mergeability calculation/i);
  assert.doesNotMatch(markdown, /reports a conflict/i);
});
