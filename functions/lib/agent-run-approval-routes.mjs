import {
  authorizeOwner,
  isOwnerWriteRequest,
  jsonResponse,
  readJsonRequest,
} from './owner-api.mjs';
import {
  createApprovalRequest,
  listPendingApprovals,
  decideApprovalRequest,
  loadApprovedApprovalById,
  loadConsumedApprovalById,
  consumeApproval,
} from './capability-approvals.mjs';
import { buildAgentPlanApprovalBinding } from '../../workers/runtime/agent-plan-approval.mjs';
import { loadCapabilityGrant } from './capability-grants.mjs';
import { getCapabilityManifest } from './capability-registry.mjs';
import { proxyAgentRuntime } from './agent-runtime-proxy.mjs';

const OWNER_ID = 'owner';
const MAX_BODY_BYTES = 1024;
const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const APPROVAL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function configured(env) {
  return Boolean(env?.AEGIS_DB && typeof env.AEGIS_DB.prepare === 'function');
}

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key));
}

async function loadPlannedRun(proxy, env, runId) {
  const response = await proxy({ env, method: 'GET', path: '/v1/agent-runs/' + runId });
  if (!response.ok) return { response };
  const contentType = response.headers.get('Content-Type') || '';
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return { response: jsonResponse({ error: 'Agent runtime returned an invalid response.' }, 502) };
  }
  let payload;
  try { payload = await response.json(); } catch {
    return { response: jsonResponse({ error: 'Agent runtime returned an invalid response.' }, 502) };
  }
  const run = payload?.run;
  if (!run || run.id !== runId || run.status !== 'planned' ||
      !run.plan || run.plan.runId !== runId) {
    return { response: jsonResponse({ error: 'Only an existing, completed plan can request execution approval.' }, 409) };
  }
  return { run };
}

export function createAgentRunApprovalHandlers({
  proxy = proxyAgentRuntime,
  createRequest = createApprovalRequest,
  listRequests = listPendingApprovals,
} = {}) {
  return {
    async onRequestGet({ request, env }) {
      const denied = await authorizeOwner(request, env);
      if (denied) return denied;
      if (!configured(env)) return jsonResponse({ error: 'Approval storage is not configured.' }, 503);
      try {
        const approvals = await listRequests(env.AEGIS_DB, 50);
        return jsonResponse({ approvals: approvals.filter((item) =>
          item.principalId === OWNER_ID && item.capabilityId === 'aegis-agent-run') });
      } catch {
        return jsonResponse({ error: 'Approval inbox is temporarily unavailable.' }, 503);
      }
    },

    async onRequestPost({ request, env }) {
      const denied = await authorizeOwner(request, env);
      if (denied) return denied;
      if (!isOwnerWriteRequest(request)) return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
      if (!configured(env)) return jsonResponse({ error: 'Approval storage is not configured.' }, 503);
      const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
      if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
      if (!exactKeys(parsed.body, ['runId']) || typeof parsed.body.runId !== 'string' ||
          !RUN_ID.test(parsed.body.runId)) {
        return jsonResponse({ error: 'Provide only a valid agent run identifier.' }, 400);
      }

      const loaded = await loadPlannedRun(proxy, env, parsed.body.runId);
      if (loaded.response) return loaded.response;
      try {
        const binding = await buildAgentPlanApprovalBinding(loaded.run.plan, OWNER_ID);
        const approval = await createRequest(env.AEGIS_DB, binding);
        return jsonResponse({ approval }, 201);
      } catch {
        return jsonResponse({ error: 'Execution approval request could not be created.' }, 503);
      }
    },
  };
}

export function createAgentRunApprovalDecisionHandlers({
  decideRequest = decideApprovalRequest,
} = {}) {
  return {
    async onRequestPatch({ request, env, params }) {
      const denied = await authorizeOwner(request, env);
      if (denied) return denied;
      if (!isOwnerWriteRequest(request)) return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
      if (!configured(env)) return jsonResponse({ error: 'Approval storage is not configured.' }, 503);
      if (typeof params?.id !== 'string' || !APPROVAL_ID.test(params.id)) {
        return jsonResponse({ error: 'Invalid approval identifier.' }, 400);
      }
      const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
      if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
      if (!exactKeys(parsed.body, ['decision']) ||
          !['approved', 'denied'].includes(parsed.body.decision)) {
        return jsonResponse({ error: 'Decision must be approved or denied.' }, 400);
      }
      try {
        const approval = await decideRequest(env.AEGIS_DB, {
          id: params.id,
          decision: parsed.body.decision,
          decidedBy: OWNER_ID,
          principalId: OWNER_ID,
          capabilityId: 'aegis-agent-run',
        });
        if (!approval || approval.principalId !== OWNER_ID ||
            approval.capabilityId !== 'aegis-agent-run') {
          return jsonResponse({ error: 'Pending agent approval was not found or has expired.' }, 404);
        }
        return jsonResponse({ approval });
      } catch {
        return jsonResponse({ error: 'Approval decision could not be recorded.' }, 503);
      }
    },
  };
}

export function createAgentRunApprovalAuthorizationHandlers({
  proxy = proxyAgentRuntime,
  loadRequest = loadApprovedApprovalById,
  loadConsumedRequest = loadConsumedApprovalById,
  loadGrant = loadCapabilityGrant,
  consumeRequest = consumeApproval,
} = {}) {
  return {
    async onRequestPost({ request, env, params }) {
      const denied = await authorizeOwner(request, env);
      if (denied) return denied;
      if (!isOwnerWriteRequest(request)) return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
      if (!configured(env)) return jsonResponse({ error: 'Approval storage is not configured.' }, 503);
      if (typeof params?.id !== 'string' || !APPROVAL_ID.test(params.id)) {
        return jsonResponse({ error: 'Invalid approval identifier.' }, 400);
      }
      const parsed = await readJsonRequest(request, 256);
      if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
      if (!exactKeys(parsed.body, [])) return jsonResponse({ error: 'No request fields are accepted.' }, 400);

      const approvalId = params.id;
      try {
        const activeApproval = await loadRequest(env.AEGIS_DB, approvalId, {
          principalId: OWNER_ID,
          capabilityId: 'aegis-agent-run',
        });
        const approval = activeApproval || await loadConsumedRequest(env.AEGIS_DB, approvalId, {
          principalId: OWNER_ID,
          capabilityId: 'aegis-agent-run',
        });
        if (!approval || approval.id !== approvalId ||
            !['approved', 'consumed'].includes(approval.status) ||
            approval.decidedBy !== OWNER_ID ||
            (approval.status === 'consumed' && !approval.consumedAt)) {
          return jsonResponse({ error: 'An active owner-approved execution request is required.' }, 409);
        }
        const match = /^agent-run:([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(approval.resourceId || '');
        if (!match) return jsonResponse({ error: 'Approval resource binding is invalid.' }, 409);
        const runId = match[1];
        const loaded = await loadPlannedRun(proxy, env, runId);
        if (loaded.response) return loaded.response;
        const binding = await buildAgentPlanApprovalBinding(loaded.run.plan, OWNER_ID);
        const fields = ['principalId', 'capabilityId', 'capabilityVersion', 'actionId',
          'resourceId', 'operationSummary', 'inputDigest'];
        if (fields.some((field) => approval[field] !== binding[field]) ||
            (approval.connectionId ?? null) !== null ||
            approval.requestedBy !== OWNER_ID) {
          return jsonResponse({ error: 'Approval no longer matches the persisted plan.' }, 409);
        }
        const manifest = getCapabilityManifest(binding.capabilityId);
        const action = manifest?.actions?.find((item) => item.id === binding.actionId);
        if (!manifest || manifest.status !== 'approved' || !action) {
          return jsonResponse({ error: 'The registered execution capability is unavailable.' }, 503);
        }
        const grant = await loadGrant(env.AEGIS_DB, {
          principalId: OWNER_ID,
          capabilityId: binding.capabilityId,
          capabilityVersion: binding.capabilityVersion,
          resourceId: binding.resourceId,
        });
        if (!grant || grant.status !== 'active' ||
            grant.principalId !== OWNER_ID ||
            grant.capabilityId !== binding.capabilityId ||
            grant.capabilityVersion !== binding.capabilityVersion ||
            grant.resourceId !== binding.resourceId ||
            !action.requiredScopes.every((scope) => grant.scopes?.includes(scope))) {
          return jsonResponse({
            error: 'An active exact-resource Sentinel grant with every required scope is required before authorisation.',
            reasonCode: 'ACTIVE_EXACT_RESOURCE_GRANT_REQUIRED',
          }, 403);
        }
        const consumed = approval.status === 'consumed'
          ? approval
          : await consumeRequest(env.AEGIS_DB, {
            id: approvalId,
            ...binding,
          });
        if (!consumed || consumed.status !== 'consumed' || consumed.id !== approvalId) {
          return jsonResponse({ error: 'Approval was already consumed or is no longer valid.' }, 409);
        }

        const upstream = await proxy({
          env,
          method: 'POST',
          path: '/v1/agent-runs/' + runId + '/authorize',
          body: {
            approvalId,
            capabilityId: binding.capabilityId,
            capabilityVersion: binding.capabilityVersion,
            actionId: binding.actionId,
            inputDigest: binding.inputDigest,
            grantId: grant.id,
          },
        });
        if (!upstream.ok) {
          return jsonResponse({
            error: 'The approval was consumed, but runtime authorisation was not confirmed. Inspect the run before requesting a new approval.',
            approvalConsumed: true,
          }, 502);
        }
        let result;
        try { result = await upstream.json(); } catch {
          return jsonResponse({ error: 'Runtime authorisation response was invalid.', approvalConsumed: true }, 502);
        }
        return jsonResponse({ approval: consumed, authorization: result, executionStarted: false });
      } catch {
        return jsonResponse({ error: 'Approval authorisation could not be completed.' }, 503);
      }
    },
  };
}
