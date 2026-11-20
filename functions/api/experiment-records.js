import {
  authorizeOwner,
  isOwnerWriteRequest,
  jsonResponse,
  readJsonRequest,
} from '../lib/owner-api.mjs';
import { createAgentExperimentRecord } from '../../workers/runtime/agent-experiment-record.mjs';
import {
  callExperimentRuntime,
  experimentRuntimeError,
} from '../lib/experiment-record-runtime.mjs';

const OWNER_ID = 'owner';
const MAX_BODY_BYTES = 256 * 1024;
const RECORD_INPUT_FIELDS = [
  'id',
  'sourceRunId',
  'benchmarkId',
  'createdAt',
  'measurementContext',
  'evaluation',
  'evidence',
];

function validListLimit(value) {
  if (value === null) return 25;
  if (!/^(?:[1-9]|[1-9][0-9]|100)$/.test(value)) return null;
  return Number(value);
}

export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;

  const url = new URL(request.url);
  const limit = validListLimit(url.searchParams.get('limit'));
  if (limit === null) return jsonResponse({ error: 'Experiment record limit must be between 1 and 100.' }, 400);

  let cursor = null;
  const rawCursor = url.searchParams.get('cursor');
  if (rawCursor !== null) {
    try {
      cursor = JSON.parse(rawCursor);
    } catch {
      return jsonResponse({ error: 'Experiment record cursor is invalid.' }, 400);
    }
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor) ||
        Object.keys(cursor).length !== 2 ||
        typeof cursor.createdAt !== 'string' ||
        typeof cursor.recordId !== 'string') {
      return jsonResponse({ error: 'Experiment record cursor is invalid.' }, 400);
    }
  }

  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set('cursor', JSON.stringify(cursor));
  const result = await callExperimentRuntime(env, OWNER_ID, '/v1/experiment-records?' + query.toString());
  if (!result.ok) {
    return jsonResponse(experimentRuntimeError(result), result.status === 400 ? 400 : 503);
  }
  return jsonResponse({
    records: Array.isArray(result.payload?.records) ? result.payload.records : [],
    nextCursor: result.payload?.nextCursor || null,
  });
}

export async function onRequestPost({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) return jsonResponse({ error: 'Invalid request origin.' }, 403);

  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((key) => !RECORD_INPUT_FIELDS.includes(key)) ||
      !['id', 'benchmarkId', 'measurementContext', 'evaluation', 'evidence'].every((key) => Object.hasOwn(body, key))) {
    return jsonResponse({ error: 'Experiment record fields are invalid.' }, 400);
  }

  let record;
  try {
    record = await createAgentExperimentRecord({
      ...body,
      ownerId: OWNER_ID,
      createdAt: body.createdAt === undefined ? new Date().toISOString() : body.createdAt,
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof TypeError ? 'Experiment record details are invalid.' : 'Experiment record could not be prepared.' },
      error instanceof TypeError ? 400 : 503);
  }

  const result = await callExperimentRuntime(env, OWNER_ID, '/v1/experiment-records', {
    method: 'POST',
    body: { record },
  });
  if (!result.ok) {
    return jsonResponse(experimentRuntimeError(result), result.status === 400 ? 400 : result.status === 409 ? 409 : 503);
  }
  return jsonResponse({
    record: result.payload?.record || record,
    created: result.payload?.created === true,
  }, result.status === 201 ? 201 : 200);
}
