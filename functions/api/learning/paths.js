import { authorizeOwner, isOwnerWriteRequest, jsonResponse, readJsonRequest } from '../../lib/owner-api.mjs';
import { listLearningPaths, registerLearningPath } from '../../lib/learning-forge.mjs';

const OWNER_ID = 'owner';
const MAX_BODY_BYTES = 128 * 1024;

export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Learning Forge storage is not configured.' }, 503);
  }
  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) {
    if (key !== 'limit' || params.getAll(key).length !== 1) {
      return jsonResponse({ error: 'Invalid or repeated Learning Forge query parameter.' }, 400);
    }
  }
  const rawLimit = params.get('limit');
  const limit = rawLimit === null ? 50 : (/^(?:[1-9]|[1-9][0-9]|100)$/.test(rawLimit) ? Number(rawLimit) : NaN);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return jsonResponse({ error: 'Learning Forge limit must be between 1 and 100.' }, 400);
  }
  try {
    const learningPaths = await listLearningPaths(env.AEGIS_DB, OWNER_ID, limit);
    return jsonResponse({ learningPaths, total: learningPaths.length });
  } catch {
    return jsonResponse({ error: 'Learning Forge catalogue is temporarily unavailable.' }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Learning Forge storage is not configured.' }, 503);
  }
  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  try {
    const result = await registerLearningPath(env.AEGIS_DB, OWNER_ID, parsed.body);
    return jsonResponse({ learningPath: result }, result.created ? 201 : 200);
  } catch (error) {
    if (error?.status === 409) return jsonResponse({ error: error.message }, 409);
    if (error instanceof TypeError) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ error: 'Learning Path could not be saved.' }, 503);
  }
}
