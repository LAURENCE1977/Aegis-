import {
  authorizeOwner,
  isOwnerWriteRequest,
  jsonResponse,
  readJsonRequest,
} from '../lib/owner-api.mjs';
import {
  callExperimentRuntime,
} from '../lib/experiment-record-runtime.mjs';

const OWNER_ID = 'owner';
const MAX_BODY_BYTES = 32 * 1024;

function validLimit(value, fallback = 25) {
  if (value === null) return fallback;
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

/** Owner-authenticated API for the durable, non-authorizing Agent Operations Inbox. */
export async function onRequest({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const limit = validLimit(url.searchParams.get('limit'));
    if (limit === null) return jsonResponse({ error: 'Agent Operations limit must be between 1 and 100.' }, 400);
    let cursor = null;
    const rawCursor = url.searchParams.get('cursor');
    if (rawCursor !== null) {
      try { cursor = JSON.parse(rawCursor); } catch {
        return jsonResponse({ error: 'Agent Operations cursor is invalid.' }, 400);
      }
      if (!exactKeys(cursor, ['createdAt', 'requestId']) ||
          typeof cursor.createdAt !== 'string' || typeof cursor.requestId !== 'string') {
        return jsonResponse({ error: 'Agent Operations cursor is invalid.' }, 400);
      }
    }
    const query = new URLSearchParams({ limit: String(limit) });
    if (cursor) query.set('cursor', JSON.stringify(cursor));
    const result = await callExperimentRuntime(env, OWNER_ID, '/v1/agent-operations?' + query.toString());
    if (!result.ok) {
      const status = [400, 404, 409, 413].includes(result.status) ? result.status : 503;
      return jsonResponse(runtimeError(result, 'Agent Operations inbox is temporarily unavailable.'), status);
    }
    if (!Array.isArray(result.payload?.requests)) {
      return jsonResponse({ error: 'Agent Operations inbox is temporarily unavailable.' }, 503);
    }
    return jsonResponse({
      requests: result.payload.requests,
      nextCursor: result.payload.nextCursor || null,
      hasMore: result.payload.hasMore === true,
    });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  if (!isOwnerWriteRequest(request)) {
    return jsonResponse({ error: 'Cross-origin writes are not allowed.' }, 403);
  }
  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!exactKeys(body, ['requestId', 'definition', 'run', 'checkpoint', 'action'])) {
    return jsonResponse({ error: 'A request ID, workflow definition, run, evidence checkpoint and proposed action are required.' }, 400);
  }

  const result = await callExperimentRuntime(env, OWNER_ID, '/v1/agent-operations', {
    method: 'POST',
    body,
  });
  if (!result.ok) {
    const status = [400, 404, 409, 413].includes(result.status) ? result.status : 503;
    return jsonResponse(runtimeError(result, 'Agent operation request could not be saved.'), status);
  }
  const operationRequest = result.payload?.request;
  if (!operationRequest || operationRequest.status !== 'awaiting_human_review' ||
      operationRequest.authority?.approvalGranted !== false ||
      operationRequest.authority?.execution !== 'not_authorised' ||
      operationRequest.authority?.sentinelApprovalRequired !== true) {
    return jsonResponse({ error: 'Agent operation request could not be verified.' }, 503);
  }
  return jsonResponse(result.payload, result.status === 201 ? 201 : 200);
}
