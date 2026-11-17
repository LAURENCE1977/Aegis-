import {
  authorizeOwner, isOwnerWriteRequest, jsonResponse, readJsonRequest,
} from '../../lib/owner-api.mjs';
import { selectCompanionProfile } from '../../lib/companion-profile-store.mjs';

const OWNER_ID = 'owner';
const MAX_BODY_BYTES = 1024;

export async function onRequestPost({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Companion Profile storage is not configured.' }, 503);
  }
  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['profileId', 'version'].includes(key)) ||
      !['profileId', 'version'].every(key => Object.hasOwn(body, key))) {
    return jsonResponse({ error: 'A profile identifier and exact version are required; use null values for official AEGIS.' }, 400);
  }
  try {
    const selection = await selectCompanionProfile(
      env.AEGIS_DB, OWNER_ID, body.profileId, body.version,
    );
    return jsonResponse(selection);
  } catch (error) {
    if ([400, 404].includes(error?.status)) return jsonResponse({ error: error.message }, error.status);
    if (error instanceof TypeError) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ error: 'Companion Profile selection could not be saved.' }, 503);
  }
}
