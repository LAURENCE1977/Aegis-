import { readFile, appendFile } from 'node:fs/promises';
import { collectMergeSnapshot, renderMergeSummary } from '../functions/lib/merge-diagnostics.mjs';
import { analyzeMergeReadiness } from '../functions/lib/merge-intelligence.mjs';

const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const eventPath = process.env.GITHUB_EVENT_PATH;
const summaryPath = process.env.GITHUB_STEP_SUMMARY;

if (!repository || !token || !eventPath || !summaryPath) {
  throw new Error('Missing required GitHub Actions environment');
}

const event = JSON.parse(await readFile(eventPath, 'utf8'));
if (!event.pull_request || !Number.isSafeInteger(event.pull_request.number)) {
  throw new Error('This workflow must run for a pull_request event');
}

const apiRoot = `https://api.github.com/repos/${repository}`;
async function githubJson(path) {
  const response = await fetch(`${apiRoot}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`GitHub API request failed (${response.status}) for ${path}`);
  }
  return response.json();
}

async function listOpenPullRequests() {
  const results = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await githubJson(`/pulls?state=open&per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error('GitHub returned an invalid pull request list');
    results.push(...batch);
    if (batch.length < 100) return results;
  }
  throw new Error('Open pull request inventory exceeded the safe 1,000-PR scan limit');
}

async function fetchCompare(pullRequest) {
  const base = encodeURIComponent(pullRequest.base.ref);
  const headLabel = pullRequest.head.label || pullRequest.head.ref;
  const head = encodeURIComponent(headLabel);
  return githubJson(`/compare/${base}...${head}`);
}

async function fetchChangedFiles(pullRequest) {
  const files = [];
  for (let page = 1; page <= 30; page += 1) {
    const batch = await githubJson(`/pulls/${pullRequest.number}/files?per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error(`GitHub returned invalid changed files for PR #${pullRequest.number}`);
    files.push(...batch);
    if (batch.length < 100) return files;
  }
  throw new Error(`Changed-file inventory for PR #${pullRequest.number} exceeded GitHub's 3,000-file limit`);
}

const openPullRequests = await listOpenPullRequests();
const snapshot = await collectMergeSnapshot(openPullRequests, fetchCompare, fetchChangedFiles);
const analysis = analyzeMergeReadiness(snapshot);
const report = renderMergeSummary(analysis);
await appendFile(summaryPath, `${report}\n`, 'utf8');
console.log(report);
