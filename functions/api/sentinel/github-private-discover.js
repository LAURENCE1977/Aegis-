import { authConfigAvailable, isAuthorized, isSameOriginRequest } from '../../lib/auth.mjs';
import { jsonResponse, readJsonRequest } from '../../lib/owner-api.mjs';
import { getCapabilityManifest } from '../../lib/capability-registry.mjs';
import { parseGitHubRepositoryUrl } from '../../lib/github-discovery.mjs';
import { runSentinelInvocation } from '../../lib/sentinel.mjs';
import { createSentinelDependencies } from '../../lib/sentinel-composition.mjs';
import { createBuiltinAdapterRegistry } from '../../lib/sentinel-adapters.mjs';

const OWNER_ID = 'owner';
const CAPABILITY_ID = 'aegis-github-private-metadata';
const ACTION_ID = 'discover';
const MAX_BODY_BYTES = 4096;

async function digestInput(input) {
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return 'sha256:' + [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function exactSourceUrl(body) {
  return body !== null && typeof body === 'object' && !Array.isArray(body) &&
    Object.keys(body).length === 1 && Object.keys(body)[0] === 'sourceUrl' &&
    typeof body.sourceUrl === 'string';
}

export async function onRequestPost({ request, env, fetchImpl = fetch }) {
  if (!authConfigAvailable(env)) return jsonResponse({ error: 'Authentication is not configured.' }, 503);
  if (!(await isAuthorized(request, env))) return jsonResponse({ error: 'Authentication required.' }, 401);
  if (!isSameOriginRequest(request)) return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Sentinel storage is not configured.' }, 503);
  }

  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  if (!exactSourceUrl(parsed.body)) {
    return jsonResponse({ error: 'Provide exactly one GitHub repository sourceUrl.' }, 400);
  }

  let repository;
  try { repository = parseGitHubRepositoryUrl(parsed.body.sourceUrl); }
  catch (error) { return jsonResponse({ error: error.message }, 400); }

  const manifest = getCapabilityManifest(CAPABILITY_ID);
  if (!manifest || manifest.status !== 'approved') {
    return jsonResponse({ error: 'Private GitHub metadata is unavailable.' }, 503);
  }

  const input = { sourceUrl: repository.canonicalUrl };
  const resourceId = 'github:private:' + repository.owner + '/' + repository.repository;
  try {
    const now = Date.now();
    const invocationId = crypto.randomUUID();
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
      env,
      adapters: createBuiltinAdapterRegistry({ fetchImpl }),
    }));

    if (!result.allowed) {
      const unavailable = [
        'POLICY_CONTEXT_UNAVAILABLE',
        'AUDIT_UNAVAILABLE',
        'RATE_LIMIT_STORE_UNAVAILABLE',
      ].includes(result.reasonCode);
      const rateLimited = result.reasonCode === 'RATE_LIMITED';
      const approvalRequired = result.reasonCode === 'APPROVAL_REQUIRED';
      return jsonResponse({
        error: approvalRequired ? 'A separate owner approval is required for this private repository operation.' :
          unavailable ? 'Sentinel policy, vault or audit storage is unavailable.' :
          rateLimited ? 'The private metadata request limit has been reached.' :
          'Private repository invocation denied.',
        reasonCode: result.reasonCode,
      }, approvalRequired ? 428 : rateLimited ? 429 : unavailable ? 503 : 403);
    }

    if (result.reasonCode !== 'SUCCESS') {
      return jsonResponse({
        error: 'Private GitHub metadata discovery failed.',
        reasonCode: result.reasonCode,
      }, 502);
    }
    if (result.output?.private !== true) {
      return jsonResponse({ error: 'This repository is public; use public GitHub discovery.' }, 409);
    }

    return jsonResponse({
      invocationId,
      reasonCode: result.reasonCode,
      repository: result.output,
      auditRecorded: result.auditRecorded === true,
    });
  } catch {
    return jsonResponse({ error: 'Sentinel private GitHub discovery is temporarily unavailable.' }, 503);
  }
}
