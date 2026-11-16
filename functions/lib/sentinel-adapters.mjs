import { listModules } from './modules.mjs';
import { discoverGitHubRepository } from './github-discovery.mjs';

async function boundedGitHubFetch(url, options, fetchImpl, timeoutMs, maxResponseBytes) {
  let parsed;
  try { parsed = new URL(url); }
  catch { throw new TypeError('Invalid adapter destination'); }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'api.github.com' ||
      parsed.port || parsed.username || parsed.password) {
    throw new TypeError('GitHub adapter destination is not allowlisted');
  }

  const response = await fetchImpl(url, {
    ...options,
    method: 'GET',
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response || !response.ok) return response;

  const declaredLength = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
    await response.body?.cancel();
    throw new Error('GitHub response exceeds the configured size limit');
  }
  if (!response.body) return response;

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxResponseBytes) {
        await reader.cancel();
        throw new Error('GitHub response exceeds the configured size limit');
      }
      chunks.push(value);
    }
  } catch (error) {
    try { await reader.cancel(); } catch {}
    throw error;
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(bytes, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * First-party, fixed adapter set. The module catalogue is local-only. Public
 * GitHub adapters read bounded repository metadata from one pinned API host;
 * the private adapter receives a credential only from the trusted vault path.
 */
export function createBuiltinAdapterRegistry({
  fetchImpl = fetch,
  timeoutMs = 5000,
  maxResponseBytes = 64 * 1024,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) {
    throw new TypeError('Invalid adapter timeout');
  }
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes < 1024 || maxResponseBytes > 1024 * 1024) {
    throw new TypeError('Invalid adapter response size limit');
  }

  return Object.freeze({
    'aegis-module-catalogue:list': async (input) => {
      if (!input || typeof input !== 'object' || Array.isArray(input) ||
          Object.keys(input).length !== 0) {
        throw new TypeError('Module catalogue adapter does not accept input');
      }
      const modules = listModules();
      return { modules, total: modules.length };
    },
    'aegis-github-public-discovery:discover': async (input) => {
      if (!input || typeof input !== 'object' || Array.isArray(input) ||
          Object.keys(input).length !== 1 || typeof input.sourceUrl !== 'string') {
        throw new TypeError('GitHub discovery adapter requires exactly one sourceUrl field');
      }
      return discoverGitHubRepository(input.sourceUrl, (url, options) =>
        boundedGitHubFetch(url, options, fetchImpl, timeoutMs, maxResponseBytes));
    },
    'aegis-github-private-metadata:discover': async (input, context) => {
      if (!input || typeof input !== 'object' || Array.isArray(input) ||
          Object.keys(input).length !== 1 || typeof input.sourceUrl !== 'string') {
        throw new TypeError('Private GitHub metadata adapter requires exactly one sourceUrl field');
      }
      const credential = context?.credential;
      if (typeof credential !== 'string' ||
          !/^(?:github_pat_|ghp_|gho_|ghu_)[A-Za-z0-9_]{20,200}$/.test(credential)) {
        throw new TypeError('An authorized GitHub bearer credential is required');
      }
      return discoverGitHubRepository(input.sourceUrl, (url, options) =>
        boundedGitHubFetch(url, {
          ...options,
          headers: { ...(options.headers || {}), Authorization: 'Bearer ' + credential },
        }, fetchImpl, timeoutMs, maxResponseBytes), { allowPrivate: true });
    },
  });
}
