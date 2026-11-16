import {
  authorizeOwner,
  isOwnerWriteRequest,
  jsonResponse,
  readJsonRequest,
} from '../lib/owner-api.mjs';
import { getCapabilityManifest } from '../lib/capability-registry.mjs';
import {
  createCapabilityGrant,
  listCapabilityGrants,
  revokeCapabilityGrant,
} from '../lib/capability-grants.mjs';

const OWNER_ID = 'owner';
const GRANT_FIELDS = [
  'id', 'capabilityId', 'capabilityVersion', 'resourceId', 'scopes',
  'status', 'createdBy', 'createdAt', 'expiresAt', 'revokedAt',
];

function publicGrant(grant) {
  return Object.fromEntries(GRANT_FIELDS.map((field) => [field, grant[field]]));
}

function exactKeys(value, allowed) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).every((key) => allowed.includes(key));
}

export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Grant storage is not configured.' }, 503);
  }

  try {
    const grants = await listCapabilityGrants(env.AEGIS_DB, OWNER_ID, 100);
    return jsonResponse({ grants: grants.map(publicGrant), total: grants.length });
  } catch {
    return jsonResponse({ error: 'Grant history is temporarily unavailable.' }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) {
    return jsonResponse({ error: 'Invalid request origin.' }, 403);
  }
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Grant storage is not configured.' }, 503);
  }

  const parsed = await readJsonRequest(request, 2048);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!exactKeys(body, ['capabilityId', 'actionIds', 'resourceId', 'expiresAt']) ||
      Object.keys(body).length !== 4 ||
      typeof body.capabilityId !== 'string' ||
      !Array.isArray(body.actionIds) || body.actionIds.length < 1 ||
      body.actionIds.length > 20 ||
      body.actionIds.some((id) => typeof id !== 'string') ||
      new Set(body.actionIds).size !== body.actionIds.length ||
      typeof body.resourceId !== 'string' ||
      typeof body.expiresAt !== 'string') {
    return jsonResponse({
      error: 'A registered capability, one or more action IDs, an exact resource and an expiry are required.',
    }, 400);
  }

  const manifest = getCapabilityManifest(body.capabilityId);
  if (!manifest || manifest.status !== 'approved') {
    return jsonResponse({ error: 'Only approved, registered capabilities can receive grants.' }, 400);
  }
  const actions = body.actionIds.map((id) => manifest.actions.find((action) => action.id === id));
  if (actions.some((action) => !action)) {
    return jsonResponse({ error: 'One or more actions are not registered for this capability.' }, 400);
  }
  const scopes = [...new Set(actions.flatMap((action) => action.requiredScopes))];
  if (scopes.length < 1) {
    return jsonResponse({ error: 'The selected actions do not declare grantable scopes.' }, 400);
  }

  try {
    const grant = await createCapabilityGrant(env.AEGIS_DB, {
      principalId: OWNER_ID,
      capabilityId: manifest.id,
      capabilityVersion: manifest.version,
      resourceId: body.resourceId,
      scopes,
      createdBy: OWNER_ID,
      expiresAt: body.expiresAt,
    });
    return jsonResponse({ grant: publicGrant(grant) }, 201);
  } catch (error) {
    if (error instanceof TypeError) {
      return jsonResponse({ error: error.message }, 400);
    }
    if (/unique constraint|already exists/i.test(error?.message || '')) {
      return jsonResponse({ error: 'An active grant already exists for this capability and resource.' }, 409);
    }
    return jsonResponse({ error: 'Grant could not be saved.' }, 503);
  }
}

export async function onRequestDelete({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) {
    return jsonResponse({ error: 'Invalid request origin.' }, 403);
  }
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Grant storage is not configured.' }, 503);
  }

  const parsed = await readJsonRequest(request, 512);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!exactKeys(body, ['id']) || Object.keys(body).length !== 1 ||
      typeof body.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(body.id)) {
    return jsonResponse({ error: 'A valid grant ID is required.' }, 400);
  }

  try {
    const revoked = await revokeCapabilityGrant(env.AEGIS_DB, body.id, OWNER_ID);
    if (!revoked) return jsonResponse({ error: 'Active grant was not found.' }, 404);
    return jsonResponse({ revoked: true, id: body.id });
  } catch {
    return jsonResponse({ error: 'Grant could not be revoked.' }, 503);
  }
}
