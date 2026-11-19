import { authorizeOwner, isOwnerWriteRequest, jsonResponse } from '../../../../../lib/owner-api.mjs';
import { withdrawLearningAppliedTaskEvidence } from '../../../../../lib/learning-mastery-evidence-store.mjs';

const OWNER_ID = 'owner';
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9]*)$/;

export async function onRequestDelete({ request, env, params }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Learning Forge storage is not configured.' }, 503);
  }

  const query = new URL(request.url).searchParams;
  for (const key of query.keys()) {
    if (!['version', 'nodeId'].includes(key) || query.getAll(key).length !== 1) {
      return jsonResponse({ error: 'Invalid or repeated Learning evidence query parameter.' }, 400);
    }
  }
  const pathId = params?.id;
  const evidenceId = params?.evidenceId;
  const version = query.get('version');
  const nodeId = query.get('nodeId');
  if (typeof pathId !== 'string' || !ID_PATTERN.test(pathId) ||
      typeof evidenceId !== 'string' || !/^evidence-[a-f0-9]{32}$/.test(evidenceId) ||
      typeof version !== 'string' || !VERSION_PATTERN.test(version) ||
      typeof nodeId !== 'string' || !ID_PATTERN.test(nodeId)) {
    return jsonResponse({ error: 'Exact evidence, path, version and node identity are required.' }, 400);
  }

  try {
    const withdrawn = await withdrawLearningAppliedTaskEvidence(
      env.AEGIS_DB, OWNER_ID, pathId, version, nodeId, evidenceId,
    );
    if (!withdrawn) return jsonResponse({ error: 'Learning evidence receipt not found.' }, 404);
    return jsonResponse({ withdrawn: true, masteryVerified: false });
  } catch {
    return jsonResponse({ error: 'Learning evidence receipt could not be withdrawn.' }, 503);
  }
}
