import { authorizeOwner } from '../../../lib/owner-api.mjs';
import { exportCompanionProfiles } from '../../../lib/companion-profile-store.mjs';

const OWNER_ID = 'owner';

export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return new Response(JSON.stringify({ error: 'Companion Profile storage is not configured.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
  try {
    const data = await exportCompanionProfiles(env.AEGIS_DB, OWNER_ID);
    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Disposition': 'attachment; filename="aegis-companion-profiles.json"',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Companion Profile export is temporarily unavailable.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
}
