import { authConfigAvailable, resolveSessionPrincipal, isSameOriginRequest } from '../../lib/auth.mjs';
import { jsonResponse, readJsonRequest } from '../../lib/owner-api.mjs';
import { getCapabilityManifest } from '../../lib/capability-registry.mjs';
import { parseGitHubRepositoryUrl } from '../../lib/github-discovery.mjs';
import { runSentinelInvocation } from '../../lib/sentinel.mjs';
import { createSentinelDependencies } from '../../lib/sentinel-composition.mjs';
import { createBuiltinAdapterRegistry } from '../../lib/sentinel-adapters.mjs';
import { digestCanonicalInput } from '../../lib/canonical-input.mjs';

const CAPABILITY_ID = 'aegis-github-public-discovery';
const ACTION_ID = 'discover';
const MAX_BODY_BYTES = 4096;


function exactSourceUrl(body) {
  return body !== null && typeof body === 'object' && !Array.isArray(body) &&
    Object.keys(body).length === 1 && Object.keys(body)[0] === 'sourceUrl' &&
    typeof body.sourceUrl === 'string';
}

/**
 * Public GitHub metadata discovery through Sentinel. The resource identity is
 * derived from the parsed canonical URL; the caller cannot choose a different
 * grant target or network destination.
 */
export async function onRequestPost({ request, env, fetchImpl = fetch }) {
  if (!authConfigAvailable(env)) {
    return jsonResponse({ error: 'Authentication is not configured.' }, 503);
  }
  const principal = await resolveSessionPrincipal(request, env);
  if (!principal) {
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
  if (!exactSourceUrl(parsed.body)) {
    return jsonResponse({ error: 'Provide exactly one GitHub repository sourceUrl.' }, 400);
  }

  let repository;
  try {
    repository = parseGitHubRepositoryUrl(parsed.body.sourceUrl);
  } catch (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  const manifest = getCapabilityManifest(CAPABILITY_ID);
  if (!manifest || manifest.status !== 'approved') {
    return jsonResponse({ error: 'GitHub public discovery is unavailable.' }, 503);
  }

  const input = { sourceUrl: repository.canonicalUrl };
  const resourceId = 'github:public:' + repository.owner + '/' + repository.repository;

  try {
    const now = Date.now();
    const invocationId = crypto.randomUUID();
    const result = await runSentinelInvocation({
      invocationId,
      principalId: principal.principalId,
      manifest,
      actionId: ACTION_ID,
      resourceId,
      inputDigest: await digestCanonicalInput(input),
      input,
      now,
    }, createSentinelDependencies({
      db: env.AEGIS_DB,
      adapters: createBuiltinAdapterRegistry({ fetchImpl }),
    }));

    if (!result.allowed) {
      const unavailable = [
        'POLICY_CONTEXT_UNAVAILABLE',
        'AUDIT_UNAVAILABLE',
        'RATE_LIMIT_STORE_UNAVAILABLE',
      ].includes(result.reasonCode);
      const rateLimited = result.reasonCode === 'RATE_LIMITED';
      return jsonResponse({
        error: unavailable ? 'Sentinel policy or audit storage is unavailable.' :
          rateLimited ? 'The capability request limit has been reached.' :
          'Capability invocation denied.',
        reasonCode: result.reasonCode,
      }, rateLimited ? 429 : unavailable ? 503 : 403);
    }

    if (result.reasonCode !== 'SUCCESS') {
      return jsonResponse({
        error: 'Public GitHub metadata discovery failed.',
        reasonCode: result.reasonCode,
      }, 502);
    }

    return jsonResponse({
      invocationId,
      reasonCode: result.reasonCode,
      repository: result.output,
      auditRecorded: result.auditRecorded === true,
    });
  } catch {
    return jsonResponse({ error: 'Sentinel GitHub discovery is temporarily unavailable.' }, 503);
  }
}
