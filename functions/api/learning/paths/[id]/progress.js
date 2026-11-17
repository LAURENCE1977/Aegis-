import { authorizeOwner, isOwnerWriteRequest, jsonResponse, readJsonRequest } from '../../../lib/owner-api.mjs';
import { listLearningProgress, updateLearningProgress } from '../../../lib/learning-progress.mjs';

const OWNER_ID = 'owner';
const MAX_BODY_BYTES = 8 * 1024;

function validVersionQuery(url) {
  const params = url.searchParams;
  for (const key of params.keys()) {
    if (!['version', 'limit'].includes(key) || params.getAll(key).length !== 1) return false;
  }
  return typeof params.get('version') === 'string' && params.get('version').length <= 32;
}

export async function onRequestGet({ request, env, params }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Learning Forge storage is not configured.' }, 503);
  }
  const url = new URL(request.url);
  if (!validVersionQuery(url)) return jsonResponse({ error: 'A single Learning Path version is required.' }, 400);
  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? 100 : (/^(?:[1-9]|[1-9][0-9]|100)$/.test(rawLimit) ? Number(rawLimit) : NaN);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return jsonResponse({ error: 'Learning Progress limit must be between 1 and 100.' }, 400);
  }
  try {
    const progress = await listLearningProgress(env.AEGIS_DB, OWNER_ID, params?.id, url.searchParams.get('version'), limit);
    return jsonResponse({ progress, total: progress.length, masteryVerified: false });
  } catch (error) {
    if (error?.status === 404) return jsonResponse({ error: 'Learning Path not found.' }, 404);
    if (error instanceof TypeError) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ error: 'Learning Progress is temporarily unavailable.' }, 503);
  }
}

export async function onRequestPatch({ request, env, params }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Learning Forge storage is not configured.' }, 503);
  }
  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['version', 'nodeId', 'status', 'expectedUpdatedAt'].includes(key)) ||
      !['version', 'nodeId', 'status', 'expectedUpdatedAt'].every(key => Object.hasOwn(body, key))) {
    return jsonResponse({ error: 'Invalid Learning Progress fields.' }, 400);
  }
  try {
    const progress = await updateLearningProgress(
      env.AEGIS_DB, OWNER_ID, params?.id, body.version, body.nodeId,
      body.status, body.expectedUpdatedAt,
    );
    return jsonResponse({ progress, masteryVerified: false });
  } catch (error) {
    if (error?.status === 404) return jsonResponse({ error: 'Learning Path not found.' }, 404);
    if (error?.status === 409) return jsonResponse({ error: error.message }, 409);
    if (error instanceof TypeError) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ error: 'Learning Progress could not be saved.' }, 503);
  }
}
