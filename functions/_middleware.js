import { classifyApiPath, withAegisImmunePipeline } from './lib/membrane/pipeline.mjs';

const invalidPathResponse = () => new Response(JSON.stringify({ error: 'INVALID_API_PATH' }), {
  status: 400,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  },
});

export const onRequest = [async (context) => {
  const classification = classifyApiPath(context.request.url);
  if (classification.kind === 'invalid') return invalidPathResponse();
  if (classification.kind === 'public') return context.next();

  // Explicitly migrate only audited endpoint/method pairs.
  // Route every login method through policy dispatch. GET remains the
  // unauthenticated session-status endpoint; POST logs in; DELETE logs out.
  const protectedRoute =
    classification.path === '/api/login' ||
    classification.path === '/api/memories' ||
    classification.path === '/api/ask' ||
    classification.path === '/api/admin/principals' ||
    classification.path === '/api/admin/tenants' ||
    classification.path === '/api/sessions' ||
    classification.path === '/api/health' ||
    classification.path === '/api/status' ||
    classification.path === '/api/account/password' ||
    classification.path === '/api/account/recovery' ||
    classification.path === '/api/tenants/invitations' ||
    classification.path === '/api/tenants/recovery';
  if (protectedRoute) return withAegisImmunePipeline(context);
  return context.next();
}];
