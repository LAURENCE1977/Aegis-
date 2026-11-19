import { authorizeOwner, isOwnerWriteRequest, jsonResponse } from '../../../../lib/owner-api.mjs';
import { recordLearningAppliedTaskEvidence, LearningMasteryPathNotFoundError, LearningAppliedEvidenceLimitError } from '../../../../lib/learning-mastery-evidence-store.mjs';
import { MAX_LEARNING_ARTIFACT_BYTES, validateLearningArtifactUpload } from '../../../../lib/learning-applied-evidence.mjs';

const OWNER_ID = 'owner';
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)$/;

async function readBoundedBody(request) {
  if (!request.body) throw new TypeError('Learning artifact body is required');
  const declaredLength = request.headers.get('Content-Length');
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_LEARNING_ARTIFACT_BYTES)) {
    throw new TypeError('Learning artifact exceeds the 2 MiB size limit');
  }
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_LEARNING_ARTIFACT_BYTES) {
        await reader.cancel('Learning artifact exceeds the size limit');
        throw new TypeError('Learning artifact exceeds the 2 MiB size limit');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function onRequestPost({ request, env, params }) {
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
  const version = query.get('version');
  const nodeId = query.get('nodeId');
  const pathId = params?.id;
  if (typeof pathId !== 'string' || !ID_PATTERN.test(pathId) ||
      typeof version !== 'string' || !VERSION_PATTERN.test(version) ||
      typeof nodeId !== 'string' || !ID_PATTERN.test(nodeId)) {
    return jsonResponse({ error: 'Exact registered path, version and node identity are required.' }, 400);
  }

  let bytes;
  let mediaType;
  try {
    bytes = await readBoundedBody(request);
    mediaType = request.headers.get('Content-Type');
    validateLearningArtifactUpload(bytes, mediaType);
  } catch (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  try {
    const evidence = await recordLearningAppliedTaskEvidence(
      env.AEGIS_DB, OWNER_ID, pathId, version, nodeId, bytes, mediaType,
    );
    return jsonResponse({
      evidence,
      contentRetained: false,
      mediaTypeVerified: false,
      masteryVerified: false,
      notice: 'Only a SHA-256 receipt and minimal metadata are stored. Keep the original artifact; it is not uploaded for later retrieval.',
    }, 201);
  } catch (error) {
    if (error instanceof LearningAppliedEvidenceLimitError || error?.status === 429) {
      return jsonResponse({ error: 'Learning applied-task evidence limit reached. Withdraw an older receipt before adding another.' }, 429);
    }
    if (error instanceof LearningMasteryPathNotFoundError || error?.status === 404) {
      return jsonResponse({ error: 'Exact registered Learning Path version or node not found.' }, 404);
    }
    return jsonResponse({ error: 'Learning applied-task evidence is temporarily unavailable.' }, 503);
  }
}
