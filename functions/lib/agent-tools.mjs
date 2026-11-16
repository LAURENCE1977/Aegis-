import { getCapabilityManifest } from './capability-registry.mjs';
import { parseGitHubRepositoryUrl } from './github-discovery.mjs';
import { createBuiltinAdapterRegistry } from './sentinel-adapters.mjs';
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
        resourceId: 'github:repo:' + repository.owner + '/' + repository.repository,
        input: { sourceUrl: repository.canonicalUrl },
      };
    } catch {
      return null;
    }
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
  principalId = 'owner',
  fetchImpl = fetch,
  now = Date.now(),
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
      now,
    }, createSentinelDependencies({
      db,
      clock: () => now,
      adapters: createBuiltinAdapterRegistry({ fetchImpl }),
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
