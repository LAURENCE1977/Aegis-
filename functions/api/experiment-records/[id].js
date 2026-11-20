import {
  authorizeOwner,
  isOwnerWriteRequest,
  jsonResponse,
} from '../../lib/owner-api.mjs';
import {
  callExperimentRuntime,
  experimentRuntimeError,
} from '../../lib/experiment-record-runtime.mjs';

const OWNER_ID = 'owner';
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;

function recordIdFrom(params) {
  const id = params?.id;
  return typeof id === 'string' && ID_PATTERN.test(id) ? id : null;
}

export async function onRequestGet({ request, env, params }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  const id = recordIdFrom(params);
  if (!id) return jsonResponse({ error: 'Experiment record not found.' }, 404);

  const result = await callExperimentRuntime(env, OWNER_ID, '/v1/experiment-records/' + encodeURIComponent(id));
  if (!result.ok) {
    return jsonResponse(experimentRuntimeError(result), result.status === 404 ? 404 : result.status === 400 ? 400 : 503);
  }
  return jsonResponse({ record: result.payload?.record || null });
}

export async function onRequestDelete({ request, env, params }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) return jsonResponse({ error: 'Invalid request origin.' }, 403);
  const id = recordIdFrom(params);
  if (!id) return jsonResponse({ error: 'Experiment record not found.' }, 404);

  const result = await callExperimentRuntime(env, OWNER_ID, '/v1/experiment-records/' + encodeURIComponent(id), {
    method: 'DELETE',
  });
  if (!result.ok) {
    return jsonResponse(experimentRuntimeError(result), result.status === 404 ? 404 : result.status === 400 ? 400 : 503);
  }
  return jsonResponse({ deleted: result.payload?.deleted === true });
}
