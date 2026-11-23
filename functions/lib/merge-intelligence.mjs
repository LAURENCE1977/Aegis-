const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const cleanString = value => typeof value === 'string' && value.trim().length > 0;

function validatePullRequest(item) {
  if (!isRecord(item) ||
      !Number.isSafeInteger(item.number) || item.number < 1 ||
      !cleanString(item.base) || !cleanString(item.head) ||
      typeof item.mergeable !== 'boolean' ||
      !isRecord(item.compare) ||
      !Number.isSafeInteger(item.compare.aheadBy) || item.compare.aheadBy < 0 ||
      !Number.isSafeInteger(item.compare.behindBy) || item.compare.behindBy < 0 ||
      !Array.isArray(item.files) ||
      item.files.some(path => !cleanString(path))) {
    throw new TypeError('Invalid pull request metadata');
  }
  return item;
}

function intersection(left, right) {
  const rightSet = new Set(right);
  return [...new Set(left)].filter(path => rightSet.has(path)).sort();
}

function buildMergeOrder(items, dependencies) {
  const byNumber = new Map(items.map(item => [item.number, item]));
  const remaining = new Set(items.map(item => item.number));
  const order = [];

  while (remaining.size) {
    const ready = [...remaining]
      .filter(number => {
        const dependency = dependencies.get(number);
        return dependency === null || dependency === undefined || !remaining.has(dependency);
      })
      .sort((a, b) => a - b);

    if (!ready.length) {
      throw new TypeError('Pull request dependency cycle detected');
    }

    for (const number of ready) {
      order.push(number);
      remaining.delete(number);
    }
  }

  return order;
}

/**
 * Analyse GitHub PR metadata without changing branches or claiming that shared
 * files are definite conflicts. GitHub's mergeable=false is the conflict signal;
 * shared paths between PRs are only a review-risk signal.
 */
export function analyzeMergeReadiness(input) {
  if (!Array.isArray(input)) throw new TypeError('Pull request metadata must be an array');

  const items = input.map(validatePullRequest);
  const numbers = new Set();
  for (const item of items) {
    if (numbers.has(item.number)) throw new TypeError('Duplicate pull request number');
    numbers.add(item.number);
  }

  const dependencies = new Map();
  for (const item of items) {
    const parents = items.filter(candidate =>
      candidate.number !== item.number && candidate.head === item.base);
    if (parents.length > 1) {
      throw new TypeError('Ambiguous pull request dependency');
    }
    dependencies.set(item.number, parents[0]?.number ?? null);
  }

  const overlaps = [];
  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      const files = intersection(items[left].files, items[right].files);
      if (files.length) {
        overlaps.push({
          pullRequests: [items[left].number, items[right].number].sort((a, b) => a - b),
          files,
        });
      }
    }
  }
  overlaps.sort((a, b) =>
    a.pullRequests[0] - b.pullRequests[0] ||
    a.pullRequests[1] - b.pullRequests[1]);

  const pullRequests = items
    .slice()
    .sort((a, b) => a.number - b.number)
    .map(item => {
      const relatedOverlaps = overlaps.filter(overlap =>
        overlap.pullRequests.includes(item.number));
      const behindBy = item.compare.behindBy;
      let recommendation = 'ready_for_review';
      if (item.mergeable === false) recommendation = 'resolve_github_conflicts';
      else if (behindBy > 0) recommendation = 'rebase_or_update_branch';
      else if (relatedOverlaps.length) recommendation = 'review_overlapping_files';

      return {
        number: item.number,
        base: item.base,
        head: item.head,
        mergeable: item.mergeable,
        dependsOn: dependencies.get(item.number),
        baseDrift: {
          status: item.compare.status ?? 'unknown',
          aheadBy: item.compare.aheadBy,
          behindBy,
          mergeBaseSha: item.compare.mergeBaseSha ?? null,
          stale: behindBy > 0,
        },
        overlappingPullRequests: relatedOverlaps.map(overlap => ({
          number: overlap.pullRequests.find(number => number !== item.number),
          files: overlap.files,
        })),
        recommendation,
      };
    });

  return {
    pullRequests,
    overlaps,
    mergeOrder: buildMergeOrder(items, dependencies),
    semantics: {
      mergeableFalse: 'GitHub reports a merge conflict or unresolved mergeability state; inspect the PR before changing it.',
      sharedFiles: 'Overlapping changed paths are a review risk, not proof of a textual merge conflict.',
      baseDrift: 'behindBy counts commits in the current base that are not in the PR head history.',
    },
  };
}
