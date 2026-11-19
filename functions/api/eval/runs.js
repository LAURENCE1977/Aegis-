import { authorizeOwner, jsonResponse } from '../../lib/owner-api.mjs';
import { listEvaluationRuns } from '../../lib/eval-forge-runs.mjs';

const OWNER_ID = 'owner';

export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Eval Forge storage is not configured.' }, 503);
  }
  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) {
    if (key !== 'limit' || params.getAll(key).length !== 1) {
      return jsonResponse({ error: 'Invalid or repeated Eval Forge query parameter.' }, 400);
    }
  }
  const rawLimit = params.get('limit');
  const limit = rawLimit === null ? 50 : (/^(?:[1-9]|[1-9][0-9]|100)$/.test(rawLimit) ? Number(rawLimit) : NaN);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return jsonResponse({ error: 'Eval Forge limit must be between 1 and 100.' }, 400);
  }
  try {
    const runs = await listEvaluationRuns(env.AEGIS_DB, OWNER_ID, limit);
    return jsonResponse({ runs, total: runs.length });
  } catch {
    return jsonResponse({ error: 'Eval Forge run history is temporarily unavailable.' }, 503);
  }
}
