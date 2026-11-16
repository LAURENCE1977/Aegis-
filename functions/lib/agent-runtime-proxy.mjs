import { jsonResponse } from './owner-api.mjs';

const MAX_REQUEST_BYTES = 8 * 1024;
const MAX_AGENT_RUN_REQUEST_BYTES = 24 * 1024;
const MAX_RESPONSE_BYTES = 64 * 1024;
const TIMEOUT_MS = 8000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function runtimeConfiguration(env) {
  const token = env?.AEGIS_JOB_TOKEN;
  if (typeof token !== 'string' || token.length < 32 || token.length > 4096 ||
      /\s/.test(token) || typeof env?.AEGIS_RUNTIME_URL !== 'string') return null;
  let url;
  try { url = new URL(env.AEGIS_RUNTIME_URL); } catch { return null; }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password ||
      url.port || (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
    return null;
  }
  return { origin: url.origin, token };
}

function validProxyTarget(method, path) {
  if (typeof method !== 'string' || typeof path !== 'string' ||
      path.length > 2048 || !path.startsWith('/') || path.startsWith('//') ||
      path.includes('#') || /[\u0000-\u0020\u007f]/.test(path)) return false;
  let url;
  try { url = new URL(path, 'https://aegis-runtime.invalid'); } catch { return false; }
  if (url.origin !== 'https://aegis-runtime.invalid' || url.hash) return false;
  const pathname = url.pathname;
  if (pathname === '/v1/agent-runs') {
    if (method === 'POST') return url.search === '';
    if (method !== 'GET') return false;
    const allowed = new Set(['limit', 'before', 'beforeId']);
    for (const key of url.searchParams.keys()) {
      if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) return false;
    }
    return true;
  }
  const match = /^\/v1\/agent-runs\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/(events|cancel|authorize))?$/i.exec(pathname);
  if (!match || !UUID_PATTERN.test(match[1])) return false;
  const suffix = match[2] || '';
  if (suffix === 'events') {
    if (method !== 'GET') return false;
    const allowed = new Set(['limit', 'before', 'beforeId']);
    for (const key of url.searchParams.keys()) {
      if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) return false;
    }
    return true;
  }
  if (url.search !== '') return false;
  return ['cancel', 'authorize'].includes(suffix) ? method === 'POST' : method === 'GET';
}

async function readJsonResponse(response) {
  const contentType = response.headers?.get?.('content-type') || '';
  if (!/application\/json(?:\s*;|$)/i.test(contentType)) {
    await response.body?.cancel();
    throw new Error('Invalid upstream content type');
  }
  const declaredLength = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new Error('Upstream response too large');
  }
  if (!response.body) throw new Error('Missing upstream response body');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('Upstream response too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock?.();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function createAgentRuntimeProxy(fetchImpl = fetch) {
  return async function proxyAgentRuntime({ env, method, path, body, idempotencyKey } = {}) {
    const config = runtimeConfiguration(env);
    if (!config) return jsonResponse({ error: 'Agent runtime is not configured.' }, 503);
    if (!validProxyTarget(method, path) ||
        (idempotencyKey !== undefined &&
          (method !== 'POST' || !IDEMPOTENCY_PATTERN.test(idempotencyKey)))) {
      return jsonResponse({ error: 'Invalid agent runtime request.' }, 400);
    }

    let requestBody;
    if (body !== undefined) {
      try { requestBody = JSON.stringify(body); } catch {
        return jsonResponse({ error: 'Invalid agent runtime request body.' }, 400);
      }
      const maxRequestBytes = method === 'POST' && path === '/v1/agent-runs'
        ? MAX_AGENT_RUN_REQUEST_BYTES
        : MAX_REQUEST_BYTES;
      if (typeof requestBody !== 'string' ||
          new TextEncoder().encode(requestBody).byteLength > maxRequestBytes) {
        return jsonResponse({ error: 'Agent runtime request body is too large.' }, 413);
      }
    }

    const headers = new Headers({
      Accept: 'application/json',
      Authorization: 'Bearer ' + config.token,
    });
    if (requestBody !== undefined) headers.set('Content-Type', 'application/json');
    if (idempotencyKey !== undefined) headers.set('Idempotency-Key', idempotencyKey);

    try {
      const response = await fetchImpl(new URL(path, config.origin), {
        method,
        headers,
        ...(requestBody === undefined ? {} : { body: requestBody }),
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const payload = await readJsonResponse(response);
      return jsonResponse(payload, response.status);
    } catch {
      return jsonResponse({ error: 'Agent runtime is temporarily unavailable.' }, 502);
    }
  };
}

export const proxyAgentRuntime = createAgentRuntimeProxy();
