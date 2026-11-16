import { getCapabilityManifest } from './capability-registry.mjs';
import { parseGitHubRepositoryUrl } from './github-discovery.mjs';
import { createBuiltinAdapterRegistry } from './sentinel-adapters.mjs';
import { createComposioAdapterRegistry } from './composio-adapters.mjs';
import { createSentinelDependencies } from './sentinel-composition.mjs';
import { runSentinelInvocation } from './sentinel.mjs';
import { digestCanonicalInput } from './canonical-input.mjs';

const QWEN_TOOL_MODEL = 'qwen3.8-flash';
const QWEN_REGIONS = new Set([
  'ap-southeast-1', 'us-east-1', 'cn-beijing', 'cn-hongkong',
  'eu-central-1', 'ap-northeast-1',
]);

const TOOL_DEFINITIONS = Object.freeze([
  Object.freeze({
    type: 'function',
    function: Object.freeze({
      name: 'aegis_list_modules',
      description: 'List the local AEGIS module catalogue and module status. Read-only; no files or code are accessed.',
      parameters: Object.freeze({
        type: 'object',
        properties: Object.freeze({}),
        required: Object.freeze([]),
        additionalProperties: false,
      }),
    }),
  }),
  Object.freeze({
    type: 'function',
    function: Object.freeze({
      name: 'aegis_discover_public_github_repository',
      description: 'Read bounded public metadata for one GitHub repository. Only public repository metadata is returned; no private repositories, source files, writes or code execution.',
      parameters: Object.freeze({
        type: 'object',
        properties: Object.freeze({
          sourceUrl: Object.freeze({
            type: 'string',
            maxLength: 2048,
            description: 'Canonical public GitHub repository URL, for example https://github.com/owner/repository',
          }),
        }),
        required: Object.freeze(['sourceUrl']),
        additionalProperties: false,
      }),
    }),
  }),
  Object.freeze({
    type: 'function',
    function: Object.freeze({
      name: 'aegis_read_github_workflow_runs',
      description: 'Read at most ten GitHub Actions workflow run summaries for one exact repository and optional branch. Requires a separate exact-resource Sentinel grant and an active Composio GitHub connection. Read-only; no logs, artifacts or workflow execution.',
      parameters: Object.freeze({
        type: 'object',
        properties: Object.freeze({
          owner: Object.freeze({ type: 'string', maxLength: 39 }),
          repo: Object.freeze({ type: 'string', maxLength: 100 }),
          branch: Object.freeze({ type: 'string', maxLength: 128 }),
        }),
        required: Object.freeze(['owner', 'repo']),
        additionalProperties: false,
      }),
    }),
  }),
  Object.freeze({
    type: 'function',
    function: Object.freeze({
      name: 'aegis_read_github_workflow_jobs',
      description: 'Read at most twenty GitHub Actions job summaries and bounded step summaries for one exact workflow run. Requires a separate exact-run Sentinel grant and active Composio GitHub connection. Read-only; no logs, artifacts or workflow controls.',
      parameters: Object.freeze({
        type: 'object',
        properties: Object.freeze({
          owner: Object.freeze({ type: 'string', maxLength: 39 }),
          repo: Object.freeze({ type: 'string', maxLength: 100 }),
          runId: Object.freeze({ type: 'integer', minimum: 1 }),
        }),
        required: Object.freeze(['owner', 'repo', 'runId']),
        additionalProperties: false,
      }),
    }),
  }),
]);

export function getAgentToolDefinitions() {
  return JSON.parse(JSON.stringify(TOOL_DEFINITIONS));
}

/**
 * Tool calling is opt-in, requires the owner-configured Qwen provider and a
 * D1 binding. The default Workers AI text-only model never receives tools.
 */
export function isAgentToolingEnabled(env) {
  if (!env || env.AEGIS_AGENT_TOOLS_ENABLED !== 'true' ||
      env.AEGIS_MODEL_PROVIDER !== 'alibaba-qwen' ||
      !env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return false;
  }
  const key = env.AEGIS_QWEN_API_KEY;
  const workspace = env.AEGIS_QWEN_WORKSPACE_ID;
  if (env.AEGIS_QWEN_MODEL !== undefined && env.AEGIS_QWEN_MODEL !== QWEN_TOOL_MODEL) return false;
  return typeof key === 'string' && key.length >= 16 && key.length <= 4096 &&
    !/[\r\n\u0000]/.test(key) &&
    typeof workspace === 'string' && workspace.length >= 3 && workspace.length <= 100 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(workspace) &&
    QWEN_REGIONS.has(env.AEGIS_QWEN_REGION);
}

function isPlainRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function parseArguments(name, argumentsText) {
  if (typeof argumentsText !== 'string' || argumentsText.length > 4096) return null;
  let value;
  try { value = JSON.parse(argumentsText); }
  catch { return null; }
  if (!isPlainRecord(value)) return null;

  if (name === 'aegis_list_modules') {
    return Object.keys(value).length === 0 ? { capabilityId: 'aegis-module-catalogue', actionId: 'list', resourceId: 'aegis:modules', input: {} } : null;
  }
  if (name === 'aegis_discover_public_github_repository') {
    if (Object.keys(value).length !== 1 || typeof value.sourceUrl !== 'string' ||
        !value.sourceUrl.trim() || value.sourceUrl.length > 2048) return null;
    try {
      const repository = parseGitHubRepositoryUrl(value.sourceUrl);
      return {
        capabilityId: 'aegis-github-public-discovery',
        actionId: 'discover',
        resourceId: 'github:public:' + repository.owner + '/' + repository.repository,
        input: { sourceUrl: repository.canonicalUrl },
      };
    } catch {
      return null;
    }
  }
  if (name === 'aegis_read_github_workflow_runs') {
    if (Object.keys(value).some(key => !['owner', 'repo', 'branch'].includes(key)) ||
        typeof value.owner !== 'string' ||
        !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(value.owner) ||
        typeof value.repo !== 'string' || !/^[A-Za-z0-9_.-]{1,100}$/.test(value.repo) ||
        (value.branch !== undefined &&
          (typeof value.branch !== 'string' || value.branch.length > 128 ||
           !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value.branch) ||
           value.branch.includes('..') || value.branch.includes('//')))) return null;
    return {
      capabilityId: 'aegis-composio-github-workflow-readonly',
      actionId: 'list-workflow-runs',
      resourceId: 'github:repository:' + value.owner + '/' + value.repo,
      input: {
        owner: value.owner,
        repo: value.repo,
        ...(value.branch === undefined ? {} : { branch: value.branch }),
      },
    };
  }

  if (name === 'aegis_read_github_workflow_jobs') {
    if (Object.keys(value).length !== 3 ||
        Object.keys(value).some(key => !['owner', 'repo', 'runId'].includes(key)) ||
        typeof value.owner !== 'string' ||
        !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(value.owner) ||
        typeof value.repo !== 'string' || !/^[A-Za-z0-9_.-]{1,100}$/.test(value.repo) ||
        !Number.isSafeInteger(value.runId) || value.runId < 1) return null;
    return {
      capabilityId: 'aegis-composio-github-workflow-jobs-readonly',
      actionId: 'list-workflow-jobs',
      resourceId: 'github:workflow-run:' + value.owner + '/' + value.repo + '/' + value.runId,
      input: { owner: value.owner, repo: value.repo, runId: value.runId },
    };
  }

  return undefined;
}


/**
 * Executes only server-defined tool names through Sentinel. The model never
 * supplies a principal, resource ID, adapter, URL destination or permission.
 */
export async function executeAgentToolCall({
  name,
  argumentsText,
  db,
  env = {},
  principalId = 'owner',
  fetchImpl = fetch,
  now = Date.now(),
  taskId = null,
  sessionId = null,
  parentSessionId = null,
  workerId = 'aegis-agent-tools',
} = {}) {
  const parsed = parseArguments(name, argumentsText);
  if (parsed === undefined) return { ok: false, reasonCode: 'TOOL_NOT_ALLOWED' };
  if (parsed === null) return { ok: false, reasonCode: 'INVALID_TOOL_ARGUMENTS' };
  if (!db || typeof db.prepare !== 'function') return { ok: false, reasonCode: 'SENTINEL_UNAVAILABLE' };

  const manifest = getCapabilityManifest(parsed.capabilityId);
  if (!manifest || manifest.status !== 'approved') {
    return { ok: false, reasonCode: 'CAPABILITY_UNAVAILABLE' };
  }

  try {
    const invocationId = crypto.randomUUID();
    const result = await runSentinelInvocation({
      invocationId,
      principalId,
      manifest,
      actionId: parsed.actionId,
      resourceId: parsed.resourceId,
      inputDigest: await digestCanonicalInput(parsed.input),
      input: parsed.input,
      taskId,
      sessionId,
      parentSessionId,
      workerId,
      now,
    }, createSentinelDependencies({
      db,
      clock: () => now,
      adapters: {
        ...createBuiltinAdapterRegistry({ fetchImpl }),
        ...(['aegis-composio-github-workflow-readonly', 'aegis-composio-github-workflow-jobs-readonly'].includes(parsed.capabilityId)
          ? createComposioAdapterRegistry({ db, env, fetchImpl })
          : {}),
      },
    }));

    if (!result.allowed || result.reasonCode !== 'SUCCESS') {
      return { ok: false, reasonCode: result.reasonCode || 'INVOCATION_DENIED' };
    }
    return {
      ok: true,
      reasonCode: 'SUCCESS',
      invocationId,
      output: result.output,
    };
  } catch {
    return { ok: false, reasonCode: 'SENTINEL_UNAVAILABLE' };
  }
}
