import {
  authorizeOwner, isOwnerWriteRequest, jsonResponse, readJsonRequest,
} from '../../lib/owner-api.mjs';
import {
  createCompanionProfile, listCompanionProfiles,
} from '../../lib/companion-profile-store.mjs';

const OWNER_ID = 'owner';
const MAX_BODY_BYTES = 8 * 1024;

export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Companion Profile storage is not configured.' }, 503);
  }
  try {
    const result = await listCompanionProfiles(env.AEGIS_DB, OWNER_ID, 50);
    return jsonResponse(result);
  } catch {
    return jsonResponse({ error: 'Companion Profiles are temporarily unavailable.' }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Companion Profile storage is not configured.' }, 503);
  }
  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  try {
    const profile = await createCompanionProfile(env.AEGIS_DB, OWNER_ID, parsed.body);
    return jsonResponse({ profile }, 201);
  } catch (error) {
    if (error instanceof TypeError) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ error: 'Companion Profile could not be saved.' }, 503);
  }
}
