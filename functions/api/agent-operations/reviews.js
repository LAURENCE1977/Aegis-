import {
  authorizeOwner,
  isOwnerWriteRequest,
  jsonResponse,
  readJsonRequest,
} from '../../lib/owner-api.mjs';
import {
  callExperimentRuntime,
} from '../../lib/experiment-record-runtime.mjs';

const OWNER_ID = 'owner';
const MAX_BODY_BYTES = 4096;

function validLimit(value) {
  if (value === null) return 50;
  if (!/^(?:[1-9]|[1-9][0-9]|100)$/.test(value)) return null;
  return Number(value);
}

function runtimeError(result, fallback) {
  if (result?.status === 400) return { error: 'Agent Operations request is invalid.' };
  if (result?.status === 404) return { error: 'Agent Operations request was not found.' };
  if (result?.status === 409) return { error: 'Agent Operations request or review conflicts with current immutable evidence.' };
  if (result?.status === 413) return { error: 'Agent Operations request is too large.' };
  return { error: fallback };
}

function exactKeys(value, keys) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === [...keys].sort().join(','));
}

/** Owner-only review history and append endpoint; decisions never authorize execution. */
export async function onRequest({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const requestId = url.searchParams.get('requestId');
    const limit = validLimit(url.searchParams.get('limit'));
    if (!requestId || limit === null) {
      return jsonResponse({ error: 'An operation request ID and a review limit between 1 and 100 are required.' }, 400);
    }
    const query = new URLSearchParams({ requestId, limit: String(limit) });
    const result = await callExperimentRuntime(
      env, OWNER_ID, '/v1/agent-operations/reviews?' + query.toString(),
    );
    if (!result.ok) {
      const status = [400, 404, 409, 413].includes(result.status) ? result.status : 503;
      return jsonResponse(runtimeError(result, 'Agent operation review history is temporarily unavailable.'), status);
    }
    if (!Array.isArray(result.payload?.reviews)) {
      return jsonResponse({ error: 'Agent operation review history is temporarily unavailable.' }, 503);
    }
    return jsonResponse({ reviews: result.payload.reviews });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  if (!isOwnerWriteRequest(request)) {
    return jsonResponse({ error: 'Cross-origin writes are not allowed.' }, 403);
  }
  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!exactKeys(body, [
    'eventId', 'requestId', 'requestDigest', 'actionDigest',
    'evidenceDigest', 'decision', 'note',
  ])) {
    return jsonResponse({ error: 'A review event ID, request ID, exact digests, decision and note are required.' }, 400);
  }

  const result = await callExperimentRuntime(env, OWNER_ID, '/v1/agent-operations/reviews', {
    method: 'POST',
    body,
  });
  if (!result.ok) {
    const status = [400, 404, 409, 413].includes(result.status) ? result.status : 503;
    if (status === 409) {
      return jsonResponse({ error: 'The review no longer matches the current operation request.' }, status);
    }
    return jsonResponse(runtimeError(result, 'Agent operation review could not be saved.'), status);
  }
  const review = result.payload?.review;
  if (!review || review.requestId !== body.requestId ||
      review.requestDigest !== body.requestDigest ||
      review.actionDigest !== body.actionDigest ||
      review.evidenceDigest !== body.evidenceDigest ||
      review.authority?.approvalGranted !== false ||
      review.authority?.execution !== 'not_authorised' ||
      review.authority?.sentinelApprovalRequired !== true) {
    return jsonResponse({ error: 'Agent operation review could not be verified.' }, 503);
  }
  return jsonResponse(result.payload, result.status === 201 ? 201 : 200);
}
