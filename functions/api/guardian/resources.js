import { authConfigAvailable, isAuthorized, isSameOriginRequest } from '../../lib/auth.mjs';
import { readJsonRequest, jsonResponse } from '../../lib/owner-api.mjs';
import { createGuardianResource, listGuardianResources } from '../../lib/guardian-catalogue.mjs';

const OWNER_ID = 'owner';
const MAX_BODY_BYTES = 64 * 1024;

export async function onRequestGet({ request, env }) {
  if (!authConfigAvailable(env)) return jsonResponse({ error: 'Authentication is not configured.' }, 503);
  if (!(await isAuthorized(request, env))) return jsonResponse({ error: 'Authentication required.' }, 401);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Guardian Resource storage is not configured.' }, 503);
  }
  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) {
    if (key !== 'limit' || params.getAll(key).length !== 1) {
      return jsonResponse({ error: 'Invalid or repeated Guardian Resource query parameter.' }, 400);
    }
  }
  const rawLimit = params.get('limit');
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return jsonResponse({ error: 'Guardian Resource limit must be between 1 and 100.' }, 400);
  }
  try {
    const resources = await listGuardianResources(env.AEGIS_DB, OWNER_ID, limit);
    return jsonResponse({ resources, total: resources.length });
  } catch (error) {
    if (error instanceof TypeError) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ error: 'Guardian Resource catalogue is temporarily unavailable.' }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!authConfigAvailable(env)) return jsonResponse({ error: 'Authentication is not configured.' }, 503);
  if (!(await isAuthorized(request, env))) return jsonResponse({ error: 'Authentication required.' }, 401);
  if (!isSameOriginRequest(request)) return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Guardian Resource storage is not configured.' }, 503);
  }
  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  try {
    const result = await createGuardianResource(env.AEGIS_DB, OWNER_ID, parsed.body);
    return jsonResponse(result, result.created ? 201 : 200);
  } catch (error) {
    if (error instanceof TypeError) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ error: 'Guardian Resource could not be saved.' }, 503);
  }
}
