import { authConfigAvailable, isAuthorized, isSameOriginRequest } from '../../lib/auth.mjs';
import { readJsonRequest, jsonResponse } from '../../lib/owner-api.mjs';
import { getCapabilityManifest } from '../../lib/capability-registry.mjs';
import { runSentinelInvocation } from '../../lib/sentinel.mjs';
import { createSentinelDependencies } from '../../lib/sentinel-composition.mjs';
import { createBuiltinAdapterRegistry } from '../../lib/sentinel-adapters.mjs';

const OWNER_ID = 'owner';
const CAPABILITY_ID = 'aegis-module-catalogue';
const ACTION_ID = 'list';
const RESOURCE_ID = 'aegis:modules';
const MAX_BODY_BYTES = 4096;

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
 * First restricted invocation endpoint. This route deliberately exposes only
 * the local read-only module catalogue; it cannot select a provider, URL,
 * adapter, shell command, browser action or arbitrary capability.
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
  if (!env.CAPABILITY_DB || typeof env.CAPABILITY_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Sentinel storage is not configured.' }, 503);
  }

  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!exactKeys(body, ['capabilityId', 'actionId', 'resourceId', 'input']) ||
      body.capabilityId !== CAPABILITY_ID ||
      body.actionId !== ACTION_ID ||
      body.resourceId !== RESOURCE_ID ||
      !body.input || typeof body.input !== 'object' ||
      Array.isArray(body.input) || Object.keys(body.input).length !== 0) {
    return jsonResponse({
      error: 'This endpoint supports only the empty-input, read-only AEGIS module catalogue action.',
    }, 400);
  }

  const manifest = getCapabilityManifest(CAPABILITY_ID);
  if (!manifest || manifest.status !== 'approved') {
    return jsonResponse({ error: 'The read-only module catalogue capability is unavailable.' }, 503);
  }

  try {
    const now = Date.now();
    const invocationId = crypto.randomUUID();
    const result = await runSentinelInvocation({
      invocationId,
      principalId: OWNER_ID,
      manifest,
      actionId: ACTION_ID,
      resourceId: RESOURCE_ID,
      inputDigest: await digestInput(body.input),
      input: body.input,
      now,
    }, createSentinelDependencies({
      db: env.CAPABILITY_DB,
      adapters: createBuiltinAdapterRegistry(),
    }));

    if (!result.allowed) {
      const unavailable = ['POLICY_CONTEXT_UNAVAILABLE', 'AUDIT_UNAVAILABLE', 'RATE_LIMIT_STORE_UNAVAILABLE'].includes(result.reasonCode);
      const rateLimited = result.reasonCode === 'RATE_LIMITED';
      return jsonResponse({
        error: unavailable ? 'Sentinel policy or audit storage is unavailable.' : 'Capability invocation denied.',
        reasonCode: result.reasonCode,
      }, rateLimited ? 429 : unavailable ? 503 : 403);
    }
    if (result.reasonCode !== 'SUCCESS') {
      return jsonResponse({ error: 'The read-only adapter could not complete the request.', reasonCode: result.reasonCode }, 502);
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
