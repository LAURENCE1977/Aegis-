import { loadConnection } from './capability-connections.mjs';
import { resolveVaultSecret } from './secret-vault.mjs';
import { createComposioClient } from './composio-client.mjs';

const CAPABILITY_ID = 'aegis-composio-github-readonly';
const ACTION_ID = 'get-repository';
const CONNECTION_SCOPE = 'composio:github-repository:read';
const GRANT_SCOPE = 'github:repository:read';
const TOOL_SLUG = 'GITHUB_GET_A_REPOSITORY';
const PULL_REQUEST_CAPABILITY_ID = 'aegis-composio-github-pull-request-readonly';
const PULL_REQUEST_ACTION_ID = 'get-pull-request';
const PULL_REQUEST_GRANT_SCOPE = 'github:pull-request:read';
const PULL_REQUEST_TOOL_SLUG = 'GITHUB_GET_A_PULL_REQUEST';
const WORKFLOW_RUNS_CAPABILITY_ID = 'aegis-composio-github-workflow-readonly';
const WORKFLOW_RUNS_ACTION_ID = 'list-workflow-runs';
const WORKFLOW_RUNS_GRANT_SCOPE = 'github:workflow:read';
const WORKFLOW_RUNS_TOOL_SLUG = 'GITHUB_LIST_WORKFLOW_RUNS_FOR_A_REPOSITORY';
const WORKFLOW_JOBS_CAPABILITY_ID = 'aegis-composio-github-workflow-jobs-readonly';
const WORKFLOW_JOBS_ACTION_ID = 'list-workflow-jobs';
const WORKFLOW_JOBS_GRANT_SCOPE = 'github:workflow-jobs:read';
const WORKFLOW_JOBS_TOOL_SLUG = 'GITHUB_LIST_JOBS_FOR_A_WORKFLOW_RUN';
const APPROVED_TOOL_SLUGS = new Set([TOOL_SLUG, PULL_REQUEST_TOOL_SLUG, WORKFLOW_RUNS_TOOL_SLUG, WORKFLOW_JOBS_TOOL_SLUG]);

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key));
}

function validateRepositoryInput(input) {
  if (!exactKeys(input, ['owner', 'repo'])) {
    throw new TypeError('Composio repository lookup requires exactly owner and repo');
  }
  if (typeof input.owner !== 'string' ||
      !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(input.owner)) {
    throw new TypeError('Invalid GitHub owner');
  }
  if (typeof input.repo !== 'string' || !/^[A-Za-z0-9_.-]{1,100}$/.test(input.repo)) {
    throw new TypeError('Invalid GitHub repository name');
  }
}

function safeString(value, maxLength = 500) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
    ? value : undefined;
}


function validatePullRequestInput(input) {
  if (!exactKeys(input, ['owner', 'repo', 'pullNumber'])) {
    throw new TypeError('Composio pull request lookup requires exactly owner, repo and pullNumber');
  }
  if (typeof input.owner !== 'string' ||
      !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(input.owner)) {
    throw new TypeError('Invalid GitHub owner');
  }
  if (typeof input.repo !== 'string' || !/^[A-Za-z0-9_.-]{1,100}$/.test(input.repo)) {
    throw new TypeError('Invalid GitHub repository name');
  }
  if (!Number.isSafeInteger(input.pullNumber) || input.pullNumber < 1) {
    throw new TypeError('Invalid GitHub pull request number');
  }
}


function validateWorkflowRunsInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      ![2, 3].includes(Object.keys(input).length) ||
      Object.keys(input).some((key) => !['owner', 'repo', 'branch'].includes(key))) {
    throw new TypeError('Composio workflow run lookup requires owner, repo and optional branch only');
  }
  if (typeof input.owner !== 'string' ||
      !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(input.owner)) {
    throw new TypeError('Invalid GitHub owner');
  }
  if (typeof input.repo !== 'string' || !/^[A-Za-z0-9_.-]{1,100}$/.test(input.repo)) {
    throw new TypeError('Invalid GitHub repository name');
  }
  if (input.branch !== undefined &&
      (typeof input.branch !== 'string' || input.branch.length < 1 || input.branch.length > 128 ||
       !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(input.branch) ||
       input.branch.includes('..') || input.branch.includes('//'))) {
    throw new TypeError('Invalid GitHub workflow branch');
  }
}


function validateWorkflowJobsInput(input) {
  if (!exactKeys(input, ['owner', 'repo', 'runId'])) {
    throw new TypeError('Composio workflow job lookup requires exactly owner, repo and runId');
  }
  if (typeof input.owner !== 'string' ||
      !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(input.owner)) {
    throw new TypeError('Invalid GitHub owner');
  }
  if (typeof input.repo !== 'string' || !/^[A-Za-z0-9_.-]{1,100}$/.test(input.repo)) {
    throw new TypeError('Invalid GitHub repository name');
  }
  if (!Number.isSafeInteger(input.runId) || input.runId < 1) {
    throw new TypeError('Invalid GitHub workflow run identifier');
  }
}

function safeWorkflowJobsResult(data, owner, repo, runId) {
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      !Number.isSafeInteger(data.total_count) || data.total_count < 0 ||
      !Array.isArray(data.jobs) || data.jobs.length > 20) {
    throw new Error('Composio returned an invalid workflow job collection');
  }
  const statuses = new Set(['queued', 'in_progress', 'completed', 'waiting', 'requested', 'pending']);
  const conclusions = new Set(['success', 'failure', 'neutral', 'cancelled', 'skipped', 'timed_out', 'action_required']);
  const stepStatuses = new Set(['queued', 'in_progress', 'completed', 'pending']);
  const jobs = data.jobs.map((job) => {
    if (!job || typeof job !== 'object' || Array.isArray(job) ||
        !Number.isSafeInteger(job.id) || job.id < 1 || job.run_id !== runId ||
        !statuses.has(job.status) ||
        (job.conclusion !== null && job.conclusion !== undefined && !conclusions.has(job.conclusion)) ||
        typeof job.name !== 'string' || !job.name.trim() || job.name.length > 200 ||
        typeof job.head_sha !== 'string' || !/^[a-f0-9]{40}$/i.test(job.head_sha) ||
        typeof job.head_branch !== 'string' || job.head_branch.length > 128) {
      throw new Error('Composio returned workflow job metadata outside the exact requested run');
    }
    const item = {
      id: job.id,
      runId: job.run_id,
      name: job.name,
      status: job.status,
      conclusion: job.conclusion ?? null,
      headSha: job.head_sha,
      headBranch: job.head_branch,
    };
    if (Number.isSafeInteger(job.run_attempt) && job.run_attempt > 0) item.runAttempt = job.run_attempt;
    if (Array.isArray(job.steps)) {
      if (job.steps.length > 100) throw new Error('Composio returned too many workflow job steps');
      item.steps = job.steps.map((step) => {
        if (!step || typeof step !== 'object' || Array.isArray(step) ||
            typeof step.name !== 'string' || !step.name.trim() || step.name.length > 200 ||
            !Number.isSafeInteger(step.number) || step.number < 1 || !stepStatuses.has(step.status) ||
            (step.conclusion !== undefined && step.conclusion !== null &&
             !conclusions.has(step.conclusion))) {
          throw new Error('Composio returned invalid workflow step metadata');
        }
        return {
          name: step.name,
          number: step.number,
          status: step.status,
          conclusion: step.conclusion ?? null,
        };
      });
    }
    const url = safeString(job.html_url, 2048);
    if (url) {
      let parsed;
      try { parsed = new URL(url); } catch { throw new Error('Composio returned an invalid workflow job URL'); }
      const expectedPath = '/' + owner + '/' + repo + '/actions/runs/' + runId + '/job/' + job.id;
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' ||
          parsed.pathname !== expectedPath || parsed.search || parsed.hash ||
          parsed.username || parsed.password || parsed.port) {
        throw new Error('Composio returned a workflow job URL outside the exact run');
      }
      item.url = parsed.toString();
    }
    return item;
  });
  return { totalCount: data.total_count, jobs };
}

function safeWorkflowRunsResult(data, owner, repo, branch) {
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      !Number.isSafeInteger(data.total_count) || data.total_count < 0 ||
      !Array.isArray(data.workflow_runs) || data.workflow_runs.length > 10) {
    throw new Error('Composio returned an invalid workflow run collection');
  }
  const statuses = new Set(['queued', 'in_progress', 'completed', 'waiting', 'requested', 'pending']);
  const conclusions = new Set(['success', 'failure', 'neutral', 'cancelled', 'skipped', 'timed_out', 'action_required', 'stale']);
  const runs = data.workflow_runs.map((run) => {
    if (!run || typeof run !== 'object' || Array.isArray(run) ||
        !Number.isSafeInteger(run.id) || run.id < 1 ||
        !statuses.has(run.status) ||
        (run.conclusion !== null && run.conclusion !== undefined && !conclusions.has(run.conclusion)) ||
        typeof run.repository?.full_name !== 'string' ||
        run.repository.full_name.toLowerCase() !== (owner + '/' + repo).toLowerCase() ||
        typeof run.head_sha !== 'string' || !/^[a-f0-9]{40}$/i.test(run.head_sha) ||
        typeof run.head_branch !== 'string' || run.head_branch.length > 128 ||
        (branch !== undefined && run.head_branch !== branch)) {
      throw new Error('Composio returned workflow metadata outside the exact requested repository or branch');
    }
    const item = {
      id: run.id,
      status: run.status,
      conclusion: run.conclusion ?? null,
      headSha: run.head_sha,
      headBranch: run.head_branch,
    };
    const name = safeString(run.name, 200);
    if (name !== undefined) item.name = name;
    const displayTitle = safeString(run.display_title, 300);
    if (displayTitle !== undefined) item.displayTitle = displayTitle;
    if (Number.isSafeInteger(run.run_number) && run.run_number > 0) item.runNumber = run.run_number;
    if (Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0) item.runAttempt = run.run_attempt;
    const url = safeString(run.html_url, 2048);
    if (url) {
      let parsed;
      try { parsed = new URL(url); } catch { throw new Error('Composio returned an invalid workflow URL'); }
      const expectedPath = '/' + owner + '/' + repo + '/actions/runs/' + run.id;
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' ||
          parsed.pathname !== expectedPath || parsed.username || parsed.password || parsed.port) {
        throw new Error('Composio returned a workflow URL outside the exact repository');
      }
      item.url = parsed.toString();
    }
    for (const [source, target] of [['created_at', 'createdAt'], ['updated_at', 'updatedAt']]) {
      const value = safeString(run[source], 40);
      if (value !== undefined && Number.isFinite(Date.parse(value))) item[target] = value;
    }
    return item;
  });
  return { totalCount: data.total_count, workflowRuns: runs };
}

function safePullRequestResult(data, owner, repo, pullNumber) {
  const baseRepository = data?.base?.repo?.full_name;
  if (typeof baseRepository !== 'string' ||
      baseRepository.toLowerCase() !== (owner + '/' + repo).toLowerCase()) {
    throw new Error('Composio returned pull request metadata outside the exact requested repository');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      data.number !== pullNumber || typeof data.title !== 'string' || !data.title.trim() ||
      data.title.length > 500 || !['open', 'closed'].includes(data.state) ||
      typeof data.draft !== 'boolean' || typeof data.merged !== 'boolean') {
    throw new Error('Composio returned pull request metadata outside the exact requested resource');
  }
  const result = {
    number: data.number,
    title: data.title,
    state: data.state,
    draft: data.draft,
    merged: data.merged,
  };
  const url = safeString(data.html_url, 2048);
  if (url) {
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('Composio returned an invalid pull request URL'); }
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' ||
        parsed.username || parsed.password || parsed.port) {
      throw new Error('Composio returned an invalid pull request URL');
    }
    result.url = parsed.toString();
  }
  for (const key of ['head', 'base']) {
    const branch = data[key];
    if (branch && typeof branch === 'object' && !Array.isArray(branch) &&
        typeof branch.ref === 'string' && branch.ref.length <= 255 &&
        typeof branch.sha === 'string' && /^[a-f0-9]{40}$/i.test(branch.sha)) {
      result[key] = { ref: branch.ref, sha: branch.sha };
    }
  }
  for (const [source, target] of [
    ['additions', 'additions'], ['deletions', 'deletions'], ['changed_files', 'changedFiles'],
  ]) {
    if (Number.isSafeInteger(data[source]) && data[source] >= 0) result[target] = data[source];
  }
  return result;
}

function safeRepositoryResult(data, owner, repo) {
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      typeof data.full_name !== 'string' ||
      data.full_name.toLowerCase() !== (owner + '/' + repo).toLowerCase() ||
      typeof data.name !== 'string' || data.name.length > 100 ||
      typeof data.private !== 'boolean') {
    throw new Error('Composio returned repository metadata outside the exact requested resource');
  }

  const repository = {
    name: data.name,
    fullName: data.full_name,
    private: data.private,
  };

  if (Number.isSafeInteger(data.id) && data.id > 0) repository.id = data.id;
  const url = safeString(data.html_url, 2048);
  if (url) {
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('Composio returned an invalid repository URL'); }
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' ||
        parsed.username || parsed.password || parsed.port) {
      throw new Error('Composio returned an invalid repository URL');
    }
    repository.url = parsed.toString();
  }
  const description = safeString(data.description, 1000);
  if (description !== undefined) repository.description = description;
  if (typeof data.archived === 'boolean') repository.archived = data.archived;
  if (typeof data.fork === 'boolean') repository.fork = data.fork;
  const defaultBranch = safeString(data.default_branch, 128);
  if (defaultBranch !== undefined) repository.defaultBranch = defaultBranch;
  if (Number.isSafeInteger(data.stargazers_count) && data.stargazers_count >= 0) {
    repository.stars = data.stargazers_count;
  }
  const language = safeString(data.language, 100);
  if (language !== undefined) repository.language = language;
  if (data.license && typeof data.license === 'object' && !Array.isArray(data.license)) {
    const name = safeString(data.license.name, 160);
    const spdxId = safeString(data.license.spdx_id, 100);
    if (name || spdxId) {
      repository.licence = {
        ...(name ? { name } : {}),
        ...(spdxId ? { spdxId } : {}),
      };
    }
  }

  return repository;
}

/**
 * Fixed Composio adapter set. This handler is intended to be called only by
 * Sentinel after the exact grant, connection, rate limit and audit checks pass.
 * It reloads the owner connection and resolves the vault secret inside trusted
 * server code; no Composio key, session URL or OAuth credential reaches an agent.
 */
export function createComposioAdapterRegistry({ db, env, fetchImpl = fetch } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('Composio adapter requires the AEGIS D1 database');
  }
  if (!env || typeof env !== 'object') {
    throw new TypeError('Composio adapter requires server environment bindings');
  }
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required');

  const handler = async (input, context = {}) => {
    validateRepositoryInput(input);
    if (context.capabilityId !== CAPABILITY_ID || context.actionId !== ACTION_ID ||
        typeof context.principalId !== 'string' || !context.principalId ||
        typeof context.connectionId !== 'string' || !context.connectionId ||
        !Array.isArray(context.scopes) || !context.scopes.includes(GRANT_SCOPE)) {
      throw new Error('Composio invocation context is not authorised');
    }

    const expectedResource = 'github:repository:' + input.owner + '/' + input.repo;
    if (context.resourceId !== expectedResource) {
      throw new Error('Composio invocation resource does not match the exact repository');
    }

    const connection = await loadConnection(db, {
      principalId: context.principalId,
      providerId: 'composio',
    });
    if (!connection || connection.id !== context.connectionId ||
        !connection.scopes.includes(CONNECTION_SCOPE)) {
      throw new Error('The exact active Composio connection is unavailable');
    }

    const stored = await resolveVaultSecret(db, {
      principalId: context.principalId,
      providerId: 'composio',
      secretRef: connection.secretRef,
    }, env);
    let session;
    try { session = JSON.parse(stored || ''); } catch {
      throw new Error('The Composio session reference is unavailable');
    }
    if (!exactKeys(session, ['sessionId', 'connectedAccountId'])) {
      throw new Error('The Composio session reference is invalid');
    }

    const client = createComposioClient({
      apiKey: env.COMPOSIO_API_KEY,
      fetchImpl,
      timeoutMs: 8000,
      maxResponseBytes: 64 * 1024,
    });
    const connected = await client.getGitHubConnectionStatus({
      sessionId: session.sessionId,
      connectedAccountId: session.connectedAccountId,
    });
    if (!connected) throw new Error('The Composio GitHub account is not active');

    const tools = await client.listSessionTools({ sessionId: session.sessionId });
    if (tools.length < 1 || tools.length > APPROVED_TOOL_SLUGS.size ||
        !tools.includes(TOOL_SLUG) || tools.some((slug) => !APPROVED_TOOL_SLUGS.has(slug))) {
      throw new Error('Composio session tool allowlist does not match the approved capability');
    }

    const result = await client.executeGitHubGetRepository({
      sessionId: session.sessionId,
      connectedAccountId: session.connectedAccountId,
      owner: input.owner,
      repo: input.repo,
    });
    return {
      repository: safeRepositoryResult(result.data, input.owner, input.repo),
      provider: 'composio',
      logId: result.logId,
    };
  };


  const pullRequestHandler = async (input, context = {}) => {
    validatePullRequestInput(input);
    if (context.capabilityId !== PULL_REQUEST_CAPABILITY_ID ||
        context.actionId !== PULL_REQUEST_ACTION_ID ||
        typeof context.principalId !== 'string' || !context.principalId ||
        typeof context.connectionId !== 'string' || !context.connectionId ||
        !Array.isArray(context.scopes) || !context.scopes.includes(PULL_REQUEST_GRANT_SCOPE)) {
      throw new Error('Composio pull request invocation context is not authorised');
    }

    const expectedResource = 'github:pull-request:' + input.owner + '/' + input.repo + '/' + input.pullNumber;
    if (context.resourceId !== expectedResource) {
      throw new Error('Composio invocation does not match the exact pull request resource');
    }

    const connection = await loadConnection(db, {
      principalId: context.principalId,
      providerId: 'composio',
    });
    if (!connection || connection.id !== context.connectionId ||
        !connection.scopes.includes(CONNECTION_SCOPE)) {
      throw new Error('The exact active Composio connection is unavailable');
    }

    const stored = await resolveVaultSecret(db, {
      principalId: context.principalId,
      providerId: 'composio',
      secretRef: connection.secretRef,
    }, env);
    let session;
    try { session = JSON.parse(stored || ''); } catch {
      throw new Error('The Composio session reference is unavailable');
    }
    if (!exactKeys(session, ['sessionId', 'connectedAccountId'])) {
      throw new Error('The Composio session reference is invalid');
    }

    const client = createComposioClient({
      apiKey: env.COMPOSIO_API_KEY,
      fetchImpl,
      timeoutMs: 8000,
      maxResponseBytes: 64 * 1024,
    });
    const connected = await client.getGitHubConnectionStatus({
      sessionId: session.sessionId,
      connectedAccountId: session.connectedAccountId,
    });
    if (!connected) throw new Error('The Composio GitHub account is not active');

    const tools = await client.listSessionTools({ sessionId: session.sessionId });
    if (!tools.includes(PULL_REQUEST_TOOL_SLUG) ||
        tools.length < 1 || tools.length > APPROVED_TOOL_SLUGS.size ||
        tools.some((slug) => !APPROVED_TOOL_SLUGS.has(slug))) {
      throw new Error('Composio session does not contain the approved pull request read-only tool');
    }

    const result = await client.executeGitHubGetPullRequest({
      sessionId: session.sessionId,
      connectedAccountId: session.connectedAccountId,
      owner: input.owner,
      repo: input.repo,
      pullNumber: input.pullNumber,
    });
    return {
      pullRequest: safePullRequestResult(result.data, input.owner, input.repo, input.pullNumber),
      provider: 'composio',
      logId: result.logId,
    };
  };


  const workflowRunsHandler = async (input, context = {}) => {
    validateWorkflowRunsInput(input);
    if (context.capabilityId !== WORKFLOW_RUNS_CAPABILITY_ID ||
        context.actionId !== WORKFLOW_RUNS_ACTION_ID ||
        typeof context.principalId !== 'string' || !context.principalId ||
        typeof context.connectionId !== 'string' || !context.connectionId ||
        !Array.isArray(context.scopes) || !context.scopes.includes(WORKFLOW_RUNS_GRANT_SCOPE)) {
      throw new Error('Composio workflow invocation context is not authorised');
    }

    const expectedResource = 'github:repository:' + input.owner + '/' + input.repo;
    if (context.resourceId !== expectedResource) {
      throw new Error('Composio workflow invocation does not match the exact repository resource');
    }

    const connection = await loadConnection(db, {
      principalId: context.principalId,
      providerId: 'composio',
    });
    if (!connection || connection.id !== context.connectionId ||
        !connection.scopes.includes(CONNECTION_SCOPE)) {
      throw new Error('The exact active Composio connection is unavailable');
    }

    const stored = await resolveVaultSecret(db, {
      principalId: context.principalId,
      providerId: 'composio',
      secretRef: connection.secretRef,
    }, env);
    let session;
    try { session = JSON.parse(stored || ''); } catch {
      throw new Error('The Composio session reference is unavailable');
    }
    if (!exactKeys(session, ['sessionId', 'connectedAccountId'])) {
      throw new Error('The Composio session reference is invalid');
    }

    const client = createComposioClient({
      apiKey: env.COMPOSIO_API_KEY,
      fetchImpl,
      timeoutMs: 8000,
      maxResponseBytes: 64 * 1024,
    });
    const connected = await client.getGitHubConnectionStatus({
      sessionId: session.sessionId,
      connectedAccountId: session.connectedAccountId,
    });
    if (!connected) throw new Error('The Composio GitHub account is not active');

    const tools = await client.listSessionTools({ sessionId: session.sessionId });
    if (!tools.includes(WORKFLOW_RUNS_TOOL_SLUG) ||
        tools.length < 1 || tools.length > APPROVED_TOOL_SLUGS.size ||
        tools.some((slug) => !APPROVED_TOOL_SLUGS.has(slug))) {
      throw new Error('Composio session does not contain the approved workflow read-only tool');
    }

    const result = await client.executeGitHubListWorkflowRuns({
      sessionId: session.sessionId,
      connectedAccountId: session.connectedAccountId,
      owner: input.owner,
      repo: input.repo,
      ...(input.branch === undefined ? {} : { branch: input.branch }),
    });
    return {
      ...safeWorkflowRunsResult(result.data, input.owner, input.repo, input.branch),
      provider: 'composio',
      logId: result.logId,
    };
  };


  const workflowJobsHandler = async (input, context = {}) => {
    validateWorkflowJobsInput(input);
    if (context.capabilityId !== WORKFLOW_JOBS_CAPABILITY_ID ||
        context.actionId !== WORKFLOW_JOBS_ACTION_ID ||
        typeof context.principalId !== 'string' || !context.principalId ||
        typeof context.connectionId !== 'string' || !context.connectionId ||
        !Array.isArray(context.scopes) || !context.scopes.includes(WORKFLOW_JOBS_GRANT_SCOPE)) {
      throw new Error('Composio workflow job invocation context is not authorised');
    }

    const expectedResource = 'github:workflow-run:' + input.owner + '/' + input.repo + '/' + input.runId;
    if (context.resourceId !== expectedResource) {
      throw new Error('Composio workflow job invocation does not match the exact workflow run resource');
    }

    const connection = await loadConnection(db, {
      principalId: context.principalId,
      providerId: 'composio',
    });
    if (!connection || connection.id !== context.connectionId ||
        !connection.scopes.includes(CONNECTION_SCOPE)) {
      throw new Error('The exact active Composio connection is unavailable');
    }

    const stored = await resolveVaultSecret(db, {
      principalId: context.principalId,
      providerId: 'composio',
      secretRef: connection.secretRef,
    }, env);
    let session;
    try { session = JSON.parse(stored || ''); } catch {
      throw new Error('The Composio session reference is unavailable');
    }
    if (!exactKeys(session, ['sessionId', 'connectedAccountId'])) {
      throw new Error('The Composio session reference is invalid');
    }

    const client = createComposioClient({
      apiKey: env.COMPOSIO_API_KEY,
      fetchImpl,
      timeoutMs: 8000,
      maxResponseBytes: 64 * 1024,
    });
    const connected = await client.getGitHubConnectionStatus({
      sessionId: session.sessionId,
      connectedAccountId: session.connectedAccountId,
    });
    if (!connected) throw new Error('The Composio GitHub account is not active');

    const tools = await client.listSessionTools({ sessionId: session.sessionId });
    if (!tools.includes(WORKFLOW_JOBS_TOOL_SLUG) ||
        tools.length < 1 || tools.length > APPROVED_TOOL_SLUGS.size ||
        tools.some((slug) => !APPROVED_TOOL_SLUGS.has(slug))) {
      throw new Error('Composio session does not contain the approved workflow job read-only tool');
    }

    const result = await client.executeGitHubListWorkflowJobs({
      sessionId: session.sessionId,
      connectedAccountId: session.connectedAccountId,
      owner: input.owner,
      repo: input.repo,
      runId: input.runId,
    });
    return {
      ...safeWorkflowJobsResult(result.data, input.owner, input.repo, input.runId),
      provider: 'composio',
      logId: result.logId,
    };
  };

  return Object.freeze({
    [CAPABILITY_ID + ':' + ACTION_ID]: handler,
    [PULL_REQUEST_CAPABILITY_ID + ':' + PULL_REQUEST_ACTION_ID]: pullRequestHandler,
    [WORKFLOW_RUNS_CAPABILITY_ID + ':' + WORKFLOW_RUNS_ACTION_ID]: workflowRunsHandler,
    [WORKFLOW_JOBS_CAPABILITY_ID + ':' + WORKFLOW_JOBS_ACTION_ID]: workflowJobsHandler,
  });
}
