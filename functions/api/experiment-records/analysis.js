import {
  authorizeOwner,
  jsonResponse,
} from '../../lib/owner-api.mjs';
import {
  callExperimentRuntime,
  experimentRuntimeError,
} from '../../lib/experiment-record-runtime.mjs';

const OWNER_ID = 'owner';

/** Return a descriptive report over verified, persisted experiment evidence. */
export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;

  const result = await callExperimentRuntime(
    env,
    OWNER_ID,
    '/v1/experiment-records/analysis',
  );
  if (!result.ok) {
    const status = result.status === 413 ? 413 : result.status === 400 ? 400 : 503;
    if (status === 413) {
      return jsonResponse({ error: 'Experiment history exceeds the analysis limit.' }, status);
    }
    return jsonResponse(experimentRuntimeError(result, 'Experiment history analysis is temporarily unavailable.'), status);
  }

  const analysis = result.payload?.analysis;
  if (!analysis || analysis.schemaVersion !== 'aegis.experiment-history-analysis.v1' ||
      analysis.ownerId !== OWNER_ID || !Number.isInteger(analysis.recordCount) ||
      !Array.isArray(analysis.cohorts)) {
    return jsonResponse({ error: 'Experiment history analysis is temporarily unavailable.' }, 503);
  }
  return jsonResponse({ analysis });
}
