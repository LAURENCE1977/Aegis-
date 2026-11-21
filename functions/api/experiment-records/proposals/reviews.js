import {
  authorizeOwner,
  isOwnerWriteRequest,
  jsonResponse,
  readJsonRequest,
} from '../../lib/owner-api.mjs';
import {
  callExperimentRuntime,
  experimentRuntimeError,
} from '../../lib/experiment-record-runtime.mjs';

const OWNER_ID = 'owner';
const REVIEW_PATH = '/v1/experiment-records/proposals/reviews';

/** Owner-only append and read access for human proposal-review observations. */
export async function onRequest({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;

  if (request.method === 'GET') {
    const result = await callExperimentRuntime(env, OWNER_ID, REVIEW_PATH);
    if (!result.ok) {
      return jsonResponse(experimentRuntimeError(result, 'Proposal review history is temporarily unavailable.'), result.status === 400 ? 400 : 503);
    }
    if (!Array.isArray(result.payload?.reviews)) {
      return jsonResponse({ error: 'Proposal review history is temporarily unavailable.' }, 503);
    }
    return jsonResponse({ reviews: result.payload.reviews });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }
  if (!isOwnerWriteRequest(request)) {
    return jsonResponse({ error: 'Cross-origin writes are not allowed.' }, 403);
  }
  const parsed = await readJsonRequest(request, 4096);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).sort().join(',') !== 'decision,eventId,note,proposalId') {
    return jsonResponse({ error: 'A proposal ID, event ID, decision and note are required.' }, 400);
  }

  const result = await callExperimentRuntime(env, OWNER_ID, REVIEW_PATH, {
    method: 'POST',
    body,
  });
  if (!result.ok) {
    const status = result.status === 400 || result.status === 409 || result.status === 413
      ? result.status : 503;
    if (status === 409) {
      return jsonResponse({ error: 'The proposal is no longer current or the review event conflicts with an existing event.' }, status);
    }
    return jsonResponse(experimentRuntimeError(result, 'Proposal review could not be saved.'), status);
  }
  const review = result.payload?.review;
  if (!review || review.ownerId !== OWNER_ID ||
      review.approvalGranted !== false || review.execution !== 'not_authorised') {
    return jsonResponse({ error: 'Proposal review could not be verified.' }, 503);
  }
  return jsonResponse(result.payload, result.status);
}
