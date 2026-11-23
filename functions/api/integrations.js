import { authConfigAvailable, isAuthorized } from '../lib/auth.mjs';
import { jsonResponse } from '../lib/owner-api.mjs';
import { createComposioBridge } from '../lib/composio-bridge.mjs';

/**
 * Owner-only, read-only view of the Composio accounts attached to this AEGIS
 * identity. Provider credentials and Composio connection state are never
 * returned to the browser.
 */
export async function onRequestGet({ request, env }) {
  if (!authConfigAvailable(env)) {
    return jsonResponse({ error: 'AEGIS authentication is not configured.' }, 503);
  }
  if (!(await isAuthorized(request, env))) {
    return jsonResponse({ error: 'Authentication required.' }, 401);
  }
  if (typeof env.COMPOSIO_API_KEY !== 'string' || env.COMPOSIO_API_KEY.length < 16 ||
      typeof env.COMPOSIO_USER_ID !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(env.COMPOSIO_USER_ID)) {
    return jsonResponse({ error: 'Composio integration is not configured.' }, 503);
  }

  try {
    const bridge = createComposioBridge({
      apiKey: env.COMPOSIO_API_KEY,
      userId: env.COMPOSIO_USER_ID,
      fetchImpl: typeof env.COMPOSIO_FETCH === 'function' ? env.COMPOSIO_FETCH : fetch,
    });
    const connections = await bridge.listConnectedAccounts();
    return jsonResponse({
      provider: 'composio',
      status: 'connected',
      connections,
      total: connections.length,
      executionEnabled: false,
    });
  } catch {
    return jsonResponse({ error: 'Composio connection status is temporarily unavailable.' }, 503);
  }
}
