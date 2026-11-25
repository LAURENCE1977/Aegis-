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
  const protectedRoute =
    (classification.path === '/api/login' && context.request.method === 'POST') ||
    (classification.path === '/api/memories' && ['GET', 'POST'].includes(context.request.method)) ||
    (classification.path === '/api/ask' && context.request.method === 'POST');
  if (protectedRoute) return withAegisImmunePipeline(context);
  return context.next();
}];
