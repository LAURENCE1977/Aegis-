import {
  authorizeOwner,
  jsonResponse,
} from '../../lib/owner-api.mjs';
import {
  callExperimentRuntime,
  experimentRuntimeError,
} from '../../lib/experiment-record-runtime.mjs';

const OWNER_ID = 'owner';

/** Return cautious review proposals derived from verified owner history. */
export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;

  const result = await callExperimentRuntime(
    env,
    OWNER_ID,
    '/v1/experiment-records/proposals',
  );
  if (!result.ok) {
    const status = result.status === 413 ? 413 : result.status === 400 ? 400 : 503;
    if (status === 413) {
      return jsonResponse({ error: 'Experiment history exceeds the proposal analysis limit.' }, status);
    }
    return jsonResponse(experimentRuntimeError(result, 'Experiment improvement proposals are temporarily unavailable.'), status);
  }

  const proposals = result.payload?.proposals;
  if (!proposals || proposals.schemaVersion !== 'aegis.experiment-proposals.v1' ||
      proposals.ownerId !== OWNER_ID || !Number.isInteger(proposals.proposalCount) ||
      !Array.isArray(proposals.proposals)) {
    return jsonResponse({ error: 'Experiment improvement proposals are temporarily unavailable.' }, 503);
  }
  return jsonResponse({ proposals });
}
