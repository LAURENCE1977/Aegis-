import {
  authorizeOwner, isOwnerWriteRequest, jsonResponse, readJsonRequest,
} from '../../../lib/owner-api.mjs';
import { updateCompanionProfile } from '../../../lib/companion-profile-store.mjs';

const OWNER_ID = 'owner';
const MAX_BODY_BYTES = 8 * 1024;
const PATCH_KEYS = ['displayName', 'description', 'appearance', 'voice', 'interaction', 'accessibility', 'memoryScope'];

export async function onRequestPatch({ request, env, params }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Companion Profile storage is not configured.' }, 503);
  }
  const profileId = params?.id;
  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['expectedVersion', ...PATCH_KEYS].includes(key)) ||
      !Object.hasOwn(body, 'expectedVersion')) {
    return jsonResponse({ error: 'Invalid Companion Profile update fields.' }, 400);
  }
  const { expectedVersion, ...patch } = body;
  try {
    const profile = await updateCompanionProfile(
      env.AEGIS_DB, OWNER_ID, profileId, expectedVersion, patch,
    );
    return jsonResponse({ profile });
  } catch (error) {
    if ([400, 404, 409].includes(error?.status)) return jsonResponse({ error: error.message }, error.status);
    if (error instanceof TypeError) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ error: 'Companion Profile could not be updated.' }, 503);
  }
}
