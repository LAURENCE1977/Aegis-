import { authorizeOwner, jsonResponse } from '../../lib/owner-api.mjs';
import {
  LearningMasteryPathNotFoundError,
  loadLearningMasteryEvidence,
} from '../../lib/learning-mastery-evidence-store.mjs';
import { buildLearningMasteryCandidate } from '../../lib/learning-mastery-evidence.mjs';

const OWNER_ID = 'owner';
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)$/;

export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Learning Mastery storage is not configured.' }, 503);
  }

  const params = new URL(request.url).searchParams;
  const allowed = ['pathId', 'pathVersion', 'nodeId'];
  for (const key of params.keys()) {
    if (!allowed.includes(key) || params.getAll(key).length !== 1) {
      return jsonResponse({ error: 'Invalid or repeated Learning Mastery query parameter.' }, 400);
    }
  }
  const pathId = params.get('pathId');
  const pathVersion = params.get('pathVersion');
  const nodeId = params.get('nodeId');
  if (!pathId || !ID_PATTERN.test(pathId) ||
      !pathVersion || !VERSION_PATTERN.test(pathVersion) ||
      !nodeId || !ID_PATTERN.test(nodeId)) {
    return jsonResponse({ error: 'An exact registered path, version and node identity are required.' }, 400);
  }

  try {
    const loaded = await loadLearningMasteryEvidence(
      env.AEGIS_DB, OWNER_ID, pathId, pathVersion, nodeId,
    );
    const candidate = buildLearningMasteryCandidate(
      loaded.path, nodeId, loaded.evidence,
    );
    return jsonResponse({
      candidate,
      unavailableEvidenceKinds: loaded.unavailableEvidenceKinds,
      sourceCounts: loaded.sourceCounts,
      certificationGranted: false,
    });
  } catch (error) {
    if (error instanceof LearningMasteryPathNotFoundError || error?.status === 404) {
      return jsonResponse({ error: 'Exact registered Learning Path version or node not found.' }, 404);
    }
    if (error instanceof TypeError) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ error: 'Learning Mastery evidence is temporarily unavailable.' }, 503);
  }
}
