import {
  authorizeOwner,
  isOwnerWriteRequest,
  jsonResponse,
  readJsonRequest,
} from '../lib/owner-api.mjs';
import { getCapabilityManifest } from '../lib/capability-registry.mjs';
import { loadConnection } from '../lib/capability-connections.mjs';
import { createApprovalRequest } from '../lib/capability-approvals.mjs';
import { parseGitHubRepositoryUrl } from '../lib/github-discovery.mjs';

const CAPABILITY_ID = 'aegis-github-private-metadata';
const ACTION_ID = 'discover';
const OWNER_ID = 'owner';

async function digestInput(input) {
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return 'sha256:' + [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) return jsonResponse({ error: 'Invalid request origin.' }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Approval storage is not configured.' }, 503);
  }

  const parsed = await readJsonRequest(request, 4096);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || typeof body.sourceUrl !== 'string') {
    return jsonResponse({ error: 'Provide exactly one sourceUrl field.' }, 400);
  }

  let repository;
  try { repository = parseGitHubRepositoryUrl(body.sourceUrl); }
  catch (error) { return jsonResponse({ error: error.message }, 400); }

  const manifest = getCapabilityManifest(CAPABILITY_ID);
  const action = manifest?.actions.find(item => item.id === ACTION_ID);
  if (!manifest || manifest.status !== 'approved' || action?.approval !== 'human-always' ||
      manifest.auth.mode !== 'oauth2' || manifest.provider.id !== 'github') {
    return jsonResponse({ error: 'Private GitHub metadata approval is unavailable.' }, 503);
  }

  const now = Date.now();
  let connection;
  try {
    connection = await loadConnection(env.AEGIS_DB, { principalId: OWNER_ID, providerId: 'github' }, now);
  } catch {
    return jsonResponse({ error: 'Provider connection could not be verified.' }, 503);
  }
  if (!connection) return jsonResponse({ error: 'Connect GitHub before requesting private metadata approval.' }, 409);

  const input = { sourceUrl: repository.canonicalUrl };
  const resourceId = 'github:private:' + repository.owner + '/' + repository.repository;
  const operationSummary = 'Read private GitHub repository metadata for ' +
    repository.owner + '/' + repository.repository;

  try {
    const approval = await createApprovalRequest(env.AEGIS_DB, {
      principalId: OWNER_ID,
      capabilityId: manifest.id,
      capabilityVersion: manifest.version,
      actionId: ACTION_ID,
      resourceId,
      operationSummary,
      connectionId: connection.id,
      inputDigest: await digestInput(input),
      requestedBy: OWNER_ID,
      expiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
    }, now);
    return jsonResponse({
      approval: {
        id: approval.id,
        capabilityId: approval.capabilityId,
        actionId: approval.actionId,
        resourceId: approval.resourceId,
        operationSummary: approval.operationSummary,
        requestedAt: approval.requestedAt,
        expiresAt: approval.expiresAt,
        status: approval.status,
      },
    }, 201);
  } catch {
    return jsonResponse({ error: 'Approval request could not be created.' }, 503);
  }
}
