import { authConfigAvailable, isAuthorized, isSameOriginRequest } from '../../lib/auth.mjs';
import { evaluateOciFreeTierPlan } from '../../lib/oci-free-cloud-forge.mjs';

const MAX_BODY_LENGTH = 8192;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export async function onRequestPost({ request, env }) {
  if (!authConfigAvailable(env)) return json({ error: 'Authentication is not configured.' }, 503);
  if (!(await isAuthorized(request, env))) return json({ error: 'Authentication required.' }, 401);
  if (!isSameOriginRequest(request)) return json({ error: 'Cross-origin request rejected.' }, 403);

  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) {
    return json({ error: 'Content-Type must be application/json.' }, 415);
  }
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > MAX_BODY_LENGTH) return json({ error: 'Request body is too large.' }, 413);

  let rawBody;
  try {
    rawBody = await request.text();
  } catch {
    return json({ error: 'Request body could not be read.' }, 400);
  }
  if (rawBody.length > MAX_BODY_LENGTH) return json({ error: 'Request body is too large.' }, 413);

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Request body must contain valid JSON.' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !Object.hasOwn(body, 'plan')) {
    return json({ error: 'Provide exactly one plan field.' }, 400);
  }

  const evaluation = evaluateOciFreeTierPlan(body.plan);
  return json({ evaluation }, evaluation.allowed ? 200 : 422);
}
