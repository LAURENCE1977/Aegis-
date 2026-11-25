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

  // The first production integration is deliberately limited to the existing
  // POST /api/login contract. All other established API handlers retain their
  // existing route-specific security controls until individually migrated.
  if (classification.path === '/api/login' && context.request.method === 'POST') {
    return withAegisImmunePipeline(context);
  }
  return context.next();
}];
