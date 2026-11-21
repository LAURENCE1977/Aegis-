import { authConfigAvailable, isAuthorized, isSameOriginRequest } from '../lib/auth.mjs';
import { validateBrowserTaskPlan } from '../lib/browser-policy.mjs';

const MAX_BODY_BYTES = 16 * 1024;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  },
});

async function readBoundedBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return '';

  const decoder = new TextDecoder();
  let body = '';
  let bytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        const error = new Error('Browser plan request is too large.');
        error.status = 413;
        throw error;
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return body;
  } finally {
    reader.releaseLock();
  }
}

export async function onRequestPost({ request, env }) {
  if (!authConfigAvailable(env)) {
    return json({ error: 'Authentication is not configured.' }, 503);
  }
  if (!(await isAuthorized(request, env))) {
    return json({ error: 'Authentication required.' }, 401);
  }
  if (!isSameOriginRequest(request)) {
    return json({ error: 'Invalid request origin.' }, 403);
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return json({ error: 'Browser plan request must be JSON.' }, 415);
  }

  let bodyText;
  try {
    bodyText = await readBoundedBody(request);
  } catch (error) {
    return json({ error: error.message }, error.status || 400);
  }

  let input;
  try {
    input = JSON.parse(bodyText);
  } catch {
    return json({ error: 'Invalid browser plan JSON.' }, 400);
  }

  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length !== 1 ||
    !Object.hasOwn(input, 'plan')
  ) {
    return json({ error: 'Browser plan request contains unsupported fields.' }, 400);
  }

  const configuredHosts = env.AEGIS_BROWSER_ALLOWED_HOSTS;
  if (
    typeof configuredHosts !== 'string' ||
    configuredHosts.length > 4096 ||
    !configuredHosts.trim()
  ) {
    return json({ error: 'Browser host allowlist is not configured.' }, 503);
  }

  const allowedHosts = configuredHosts.split(',').map(host => host.trim());
  const result = validateBrowserTaskPlan(input.plan, { allowedHosts });
  if (!result.ok) {
    return json({
      error: result.error,
      code: 'BROWSER_POLICY_REJECTED',
    }, 400);
  }

  return json({
    ok: true,
    plan: result.normalized,
    decision: result.decision,
  });
}
