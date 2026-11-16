import { authConfigAvailable, isAuthorized, isSameOriginRequest } from '../../lib/auth.mjs';
import { readJsonRequest, jsonResponse } from '../../lib/owner-api.mjs';
import { getCapabilityManifest } from '../../lib/capability-registry.mjs';
import { runSentinelInvocation } from '../../lib/sentinel.mjs';
import { createSentinelDependencies } from '../../lib/sentinel-composition.mjs';
import { createBuiltinAdapterRegistry } from '../../lib/sentinel-adapters.mjs';
import { createComposioAdapterRegistry } from '../../lib/composio-adapters.mjs';

const OWNER_ID = 'owner';
const CAPABILITY_ID = 'aegis-composio-github-workflow-jobs-readonly';
const ACTION_ID = 'list-workflow-jobs';
const MAX_BODY_BYTES = 2048;
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;

async function digestInput(input) {
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return 'sha256:' + [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validInput(input) {
  return input !== null && typeof input === 'object' && !Array.isArray(input) &&
    Object.keys(input).length === 3 &&
    Object.keys(input).every((key) => ['owner', 'repo', 'runId'].includes(key)) &&
    typeof input.owner === 'string' && OWNER_PATTERN.test(input.owner) &&
    typeof input.repo === 'string' && REPOSITORY_PATTERN.test(input.repo) &&
    Number.isSafeInteger(input.runId) && input.runId > 0;
}

export async function onRequestPost({ request, env }) {
  if (!authConfigAvailable(env)) return jsonResponse({ error: 'Authentication is not configured.' }, 503);
  if (!(await isAuthorized(request, env))) return jsonResponse({ error: 'Authentication required.' }, 401);
  if (!isSameOriginRequest(request)) return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Sentinel storage is not configured.' }, 503);
  }

  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const input = parsed.body;
  if (!validInput(input)) {
    return jsonResponse({ error: 'Provide exactly one valid GitHub owner, repository and positive workflow run ID.' }, 400);
  }

  const resourceId = 'github:workflow-run:' + input.owner + '/' + input.repo + '/' + input.runId;
  const manifest = getCapabilityManifest(CAPABILITY_ID);
  if (!manifest || manifest.status !== 'approved') {
    return jsonResponse({ error: 'The Composio GitHub workflow job capability is unavailable.' }, 503);
  }

  try {
    const now = Date.now();
    const invocationId = crypto.randomUUID();
    const adapters = {
      ...createBuiltinAdapterRegistry(),
      ...createComposioAdapterRegistry({ db: env.AEGIS_DB, env }),
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
    }, createSentinelDependencies({ db: env.AEGIS_DB, adapters }));

    if (!result.allowed) {
      const unavailable = [
        'POLICY_CONTEXT_UNAVAILABLE', 'AUDIT_UNAVAILABLE', 'RATE_LIMIT_STORE_UNAVAILABLE',
      ].includes(result.reasonCode);
      const rateLimited = result.reasonCode === 'RATE_LIMITED';
      return jsonResponse({
        error: unavailable ? 'Sentinel policy or audit storage is unavailable.' : 'Capability invocation denied.',
        reasonCode: result.reasonCode,
      }, rateLimited ? 429 : unavailable ? 503 : 403);
    }
    if (result.reasonCode !== 'SUCCESS') {
      return jsonResponse({
        error: 'The Composio GitHub workflow job lookup could not complete.',
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
