import { authorizeOwner, isOwnerWriteRequest, jsonResponse, readJsonRequest } from '../../../lib/owner-api.mjs';
import { listLearningAttempts, submitLearningAttempt } from '../../../lib/learning-attempts.mjs';

const OWNER_ID = 'owner';
const MAX_BODY_BYTES = 16 * 1024;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9]*)$/;

export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Learning Attempt storage is not configured.' }, 503);
  }
  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) {
    if (!['assessmentId', 'assessmentVersion', 'limit'].includes(key) || params.getAll(key).length !== 1) {
      return jsonResponse({ error: 'Invalid or repeated Learning Attempt query parameter.' }, 400);
    }
  }
  const assessmentId = params.get('assessmentId');
  const assessmentVersion = params.get('assessmentVersion');
  const rawLimit = params.get('limit');
  const limit = rawLimit === null ? 50 : (/^(?:[1-9]|[1-9][0-9]|100)$/.test(rawLimit) ? Number(rawLimit) : NaN);
  if (!assessmentId || !ID_PATTERN.test(assessmentId) ||
      !assessmentVersion || !VERSION_PATTERN.test(assessmentVersion) ||
      !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return jsonResponse({ error: 'A valid assessment identity and bounded limit are required.' }, 400);
  }
  try {
    const attempts = await listLearningAttempts(env.AEGIS_DB, OWNER_ID, assessmentId, assessmentVersion, limit);
    return jsonResponse({ attempts, total: attempts.length });
  } catch {
    return jsonResponse({ error: 'Learning Attempt history is temporarily unavailable.' }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Learning Attempt storage is not configured.' }, 503);
  }
  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['assessmentId', 'assessmentVersion', 'answers'].includes(key)) ||
      !['assessmentId', 'assessmentVersion', 'answers'].every(key => Object.hasOwn(body, key))) {
    return jsonResponse({ error: 'Invalid Learning Attempt fields.' }, 400);
  }
  try {
    const attempt = await submitLearningAttempt(
      env.AEGIS_DB, OWNER_ID, body.assessmentId, body.assessmentVersion, body.answers,
    );
    return jsonResponse({ attempt }, 201);
  } catch (error) {
    if ([400, 404, 429].includes(error?.status)) return jsonResponse({ error: error.message }, error.status);
    if (error instanceof TypeError) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ error: 'Learning Attempt could not be saved.' }, 503);
  }
}
