import {
  authorizeOwner, isOwnerWriteRequest, jsonResponse, readJsonRequest,
} from '../../../lib/owner-api.mjs';
import { purgeCompanionProfiles } from '../../../lib/companion-profile-store.mjs';

const OWNER_ID = 'owner';
const MAX_BODY_BYTES = 1024;
const CONFIRMATION = 'DELETE MY COMPANION PROFILES';

export async function onRequestPost({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function' ||
      typeof env.AEGIS_DB.batch !== 'function') {
    return jsonResponse({ error: 'Atomic Companion Profile storage is not configured.' }, 503);
  }
  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || body.confirmation !== CONFIRMATION) {
    return jsonResponse({ error: 'Type the exact confirmation phrase to delete all custom Companion Profiles.' }, 400);
  }
  try {
    const result = await purgeCompanionProfiles(env.AEGIS_DB, OWNER_ID, body.confirmation);
    return jsonResponse(result);
  } catch (error) {
    if (error instanceof TypeError) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ error: 'Companion Profile purge could not be completed.' }, 503);
  }
}
