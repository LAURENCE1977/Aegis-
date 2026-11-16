import { authConfigAvailable, isAuthorized, isSameOriginRequest } from '../../lib/auth.mjs';
import { readJsonRequest, jsonResponse } from '../../lib/owner-api.mjs';
import { getCapabilityManifest } from '../../lib/capability-registry.mjs';
import { runSentinelInvocation } from '../../lib/sentinel.mjs';
import { createSentinelDependencies } from '../../lib/sentinel-composition.mjs';
import { createBuiltinAdapterRegistry } from '../../lib/sentinel-adapters.mjs';
import { createComposioAdapterRegistry } from '../../lib/composio-adapters.mjs';

const OWNER_ID = 'owner';
const CAPABILITY_ID = 'aegis-composio-github-readonly';
const ACTION_ID = 'get-repository';
const MAX_BODY_BYTES = 2048;
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;

async function digestInput(input) {
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return 'sha256:' + [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function exactKeys(value, allowed) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === allowed.length &&
    Object.keys(value).every((key) => allowed.includes(key));
}

/**
 * The only public entry point for this Composio capability. The caller can
 * select an exact repository, but cannot choose a provider, tool slug, URL,
 * account, adapter, or arbitrary Composio action. Sentinel derives and checks
 * the exact repository resource before the adapter resolves any vault secret.
 */
export async function onRequestPost({ request, env }) {
  if (!authConfigAvailable(env)) {
    return jsonResponse({ error: 'Authentication is not configured.' }, 503);
  }
  if (!(await isAuthorized(request, env))) {
    return jsonResponse({ error: 'Authentication required.' }, 401);
  }
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
  }
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Sentinel storage is not configured.' }, 503);
  }

  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const input = parsed.body;
  if (!exactKeys(input, ['owner', 'repo']) ||
      typeof input.owner !== 'string' || !OWNER_PATTERN.test(input.owner) ||
      typeof input.repo !== 'string' || !REPOSITORY_PATTERN.test(input.repo)) {
    return jsonResponse({
      error: 'Provide exactly one valid GitHub owner and repository name.',
    }, 400);
  }

  const resourceId = 'github:repository:' + input.owner + '/' + input.repo;
  const manifest = getCapabilityManifest(CAPABILITY_ID);
  if (!manifest || manifest.status !== 'approved') {
    return jsonResponse({ error: 'The Composio GitHub capability is unavailable.' }, 503);
  }

  try {
    const now = Date.now();
    const invocationId = crypto.randomUUID();
    const adapters = {
      ...createBuiltinAdapterRegistry(),
      ...createComposioAdapterRegistry({
        db: env.AEGIS_DB,
        env,
      }),
    };
    const result = await runSentinelInvocation({
      invocationId,
      principalId: OWNER_ID,
      manifest,
      actionId: ACTION_ID,
      resourceId,
      inputDigest: await digestInput(input),
      input,
      now,
    }, createSentinelDependencies({
      db: env.AEGIS_DB,
      adapters,
    }));

    if (!result.allowed) {
      const unavailable = [
        'POLICY_CONTEXT_UNAVAILABLE',
        'AUDIT_UNAVAILABLE',
        'RATE_LIMIT_STORE_UNAVAILABLE',
      ].includes(result.reasonCode);
      const rateLimited = result.reasonCode === 'RATE_LIMITED';
      return jsonResponse({
        error: unavailable ? 'Sentinel policy or audit storage is unavailable.' : 'Capability invocation denied.',
        reasonCode: result.reasonCode,
      }, rateLimited ? 429 : unavailable ? 503 : 403);
    }
    if (result.reasonCode !== 'SUCCESS') {
      return jsonResponse({
        error: 'The Composio GitHub repository lookup could not complete.',
        reasonCode: result.reasonCode,
      }, 502);
    }

    return jsonResponse({
      invocationId,
      reasonCode: result.reasonCode,
      output: result.output,
      auditRecorded: result.auditRecorded === true,
    });
  } catch {
    return jsonResponse({ error: 'Sentinel invocation is temporarily unavailable.' }, 503);
  }
}
