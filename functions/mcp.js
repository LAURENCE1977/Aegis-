import { handleMcpRequest } from './lib/bridge.mjs';

export async function onRequestPost({ request, env }) {
  return handleMcpRequest(request, env);
}
