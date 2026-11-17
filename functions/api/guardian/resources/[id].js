import { authConfigAvailable, isAuthorized, isSameOriginRequest } from '../../../lib/auth.mjs';
import { readJsonRequest, jsonResponse } from '../../../lib/owner-api.mjs';
import { updateGuardianResourceReview } from '../../../lib/guardian-catalogue.mjs';

const OWNER_ID = 'owner';
const MAX_BODY_BYTES = 8 * 1024;

export async function onRequestPatch({ request, env, params }) {
  if (!authConfigAvailable(env)) return jsonResponse({ error: 'Authentication is not configured.' }, 503);
  if (!(await isAuthorized(request, env))) return jsonResponse({ error: 'Authentication required.' }, 401);
  if (!isSameOriginRequest(request)) return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Guardian Resource storage is not configured.' }, 503);
  }
  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  try {
    const resource = await updateGuardianResourceReview(env.AEGIS_DB, OWNER_ID, params?.id, parsed.body);
    return jsonResponse({ resource });
  } catch (error) {
    if (error?.status === 404) return jsonResponse({ error: 'Guardian Resource not found.' }, 404);
    if (error?.status === 409) return jsonResponse({ error: 'Guardian Resource changed since it was loaded. Refresh and retry.' }, 409);
    if (error instanceof TypeError) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ error: 'Guardian Resource review could not be saved.' }, 503);
  }
}