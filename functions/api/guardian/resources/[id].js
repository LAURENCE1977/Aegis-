import { authConfigAvailable, isAuthorized } from '../../../lib/auth.mjs';
import { authorizeReviewer, readJsonRequest, jsonResponse } from '../../../lib/owner-api.mjs';
import {
  getGuardianResource,
  listGuardianResourceEvents,
  updateGuardianResourceReview,
} from '../../../lib/guardian-catalogue.mjs';

const OWNER_ID = 'owner';
const REVIEWER_ID = 'reviewer';
const MAX_BODY_BYTES = 8 * 1024;
const MAX_EVENT_LIMIT = 100;
const RESOURCE_ID_PATTERN = /^resource-[a-f0-9]{32}$/;

export async function onRequestGet({ request, env, params }) {
  if (!authConfigAvailable(env)) return jsonResponse({ error: 'Authentication is not configured.' }, 503);
  if (!(await isAuthorized(request, env))) return jsonResponse({ error: 'Authentication required.' }, 401);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Guardian Resource storage is not configured.' }, 503);
  }
  if (typeof params?.id !== 'string' || !RESOURCE_ID_PATTERN.test(params.id)) {
    return jsonResponse({ error: 'Invalid Guardian Resource identifier.' }, 400);
  }

  const query = new URL(request.url).searchParams;
  for (const key of query.keys()) {
    if (key !== 'eventLimit' || query.getAll(key).length !== 1) {
      return jsonResponse({ error: 'Invalid or repeated Guardian Resource query parameter.' }, 400);
    }
  }
  const rawLimit = query.get('eventLimit');
  const eventLimit = rawLimit === null ? 50 : Number(rawLimit);
  if (!Number.isInteger(eventLimit) || eventLimit < 1 || eventLimit > MAX_EVENT_LIMIT) {
    return jsonResponse({ error: 'Guardian Resource eventLimit must be between 1 and 100.' }, 400);
  }

  try {
    const resource = await getGuardianResource(env.AEGIS_DB, OWNER_ID, params?.id);
    if (!resource) return jsonResponse({ error: 'Guardian Resource not found.' }, 404);
    const events = await listGuardianResourceEvents(env.AEGIS_DB, OWNER_ID, params.id, eventLimit);
    return jsonResponse({ resource, events });
  } catch {
    return jsonResponse({ error: 'Guardian Resource detail is temporarily unavailable.' }, 503);
  }
}

export async function onRequestPatch({ request, env, params }) {
  const denied = await authorizeReviewer(request, env);
  if (denied) return denied;
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Guardian Resource storage is not configured.' }, 503);
  }
  if (typeof params?.id !== 'string' || !RESOURCE_ID_PATTERN.test(params.id)) {
    return jsonResponse({ error: 'Invalid Guardian Resource identifier.' }, 400);
  }
  if (!request.headers.get('Origin') || new URL(request.headers.get('Origin')).origin !== new URL(request.url).origin) {
    return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
  }
  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  try {
    const resource = await updateGuardianResourceReview(env.AEGIS_DB, OWNER_ID, params.id, {
      ...parsed.body,
      reviewerId: REVIEWER_ID,
    });
    return jsonResponse({ resource });
  } catch (error) {
    if (error?.status === 404) return jsonResponse({ error: 'Guardian Resource not found.' }, 404);
    if (error?.status === 409) return jsonResponse({ error: 'Guardian Resource changed since it was loaded. Refresh and retry.' }, 409);
    if (error instanceof TypeError) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ error: 'Guardian Resource review could not be saved.' }, 503);
  }
}
