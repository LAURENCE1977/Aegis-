function runtimeConfig(env) {
  if (typeof env?.AEGIS_RUNTIME_URL !== 'string' ||
      typeof env?.AEGIS_JOB_TOKEN !== 'string' ||
      env.AEGIS_JOB_TOKEN.length < 32) return null;
  try {
    const url = new URL(env.AEGIS_RUNTIME_URL);
    if (url.protocol !== 'https:' || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash) return null;
    return { origin: url.origin, token: env.AEGIS_JOB_TOKEN };
  } catch {
    return null;
  }
}

/**
 * Server-to-server adapter. Call only after the Pages request has passed its
 * owner-session guard. principalId must be a server-owned constant, never
 * copied from browser input. The runtime bearer token is never sent to clients.
 */
export async function callExperimentRuntime(env, principalId, path, {
  method = 'GET',
  body,
} = {}) {
  if (principalId !== 'owner') {
    return { ok: false, status: 500, payload: null };
  }
  const config = runtimeConfig(env);
  if (!config) return { ok: false, status: 503, payload: null };
  const routePath = typeof path === 'string' ? path.split('?')[0] : '';
  if (routePath !== '/v1/experiment-records' && !routePath.startsWith('/v1/experiment-records/') &&
      routePath !== '/v1/agent-operations' && !routePath.startsWith('/v1/agent-operations/')) {
    return { ok: false, status: 500, payload: null };
  }

  const headers = {
    Authorization: 'Bearer ' + config.token,
    'X-Aegis-Principal': principalId,
    Accept: 'application/json',
  };
  const init = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(new URL(path, config.origin), init);
    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }
    return { ok: response.ok, status: response.status, payload };
  } catch {
    return { ok: false, status: 502, payload: null };
  }
}

export function experimentRuntimeError(result, fallback = 'Experiment record service is temporarily unavailable.') {
  if (result?.status === 400) return { error: 'Experiment record request is invalid.' };
  if (result?.status === 404) return { error: 'Experiment record not found.' };
  if (result?.status === 409) return { error: 'An immutable experiment record with this identifier already exists.' };
  if (result?.status === 413) return { error: 'Experiment record request is too large.' };
  return { error: fallback };
}
