import { authorizeOwner, isOwnerWriteRequest, jsonResponse, readJsonRequest } from '../../lib/owner-api.mjs';
import { listLearningAssessments, registerLearningAssessment } from '../../lib/learning-assessment-store.mjs';

const OWNER_ID = 'owner';
const MAX_BODY_BYTES = 64 * 1024;

export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Learning Assessment storage is not configured.' }, 503);
  }
  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) {
    if (key !== 'limit' || params.getAll(key).length !== 1) {
      return jsonResponse({ error: 'Invalid or repeated Learning Assessment query parameter.' }, 400);
    }
  }
  const rawLimit = params.get('limit');
  const limit = rawLimit === null ? 50 : (/^(?:[1-9]|[1-9][0-9]|100)$/.test(rawLimit) ? Number(rawLimit) : NaN);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return jsonResponse({ error: 'Learning Assessment limit must be between 1 and 100.' }, 400);
  }
  try {
    const assessments = await listLearningAssessments(env.AEGIS_DB, OWNER_ID, limit);
    return jsonResponse({ assessments, total: assessments.length });
  } catch {
    return jsonResponse({ error: 'Learning Assessment catalogue is temporarily unavailable.' }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Learning Assessment storage is not configured.' }, 503);
  }
  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  try {
    const result = await registerLearningAssessment(env.AEGIS_DB, OWNER_ID, parsed.body);
    return jsonResponse({
      assessment: {
        id: result.assessment.id,
        version: result.assessment.version,
        pathId: result.assessment.pathId,
        pathVersion: result.assessment.pathVersion,
        nodeId: result.assessment.nodeId,
        digest: result.digest,
        createdAt: result.createdAt,
        created: result.created,
      },
    }, result.created ? 201 : 200);
  } catch (error) {
    if (error?.status === 409) return jsonResponse({ error: error.message }, 409);
    if (error instanceof TypeError) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ error: 'Learning Assessment could not be saved.' }, 503);
  }
}
