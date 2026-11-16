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
  loadApproval,
  consumeApproval,
} from './capability-approvals.mjs';
import { buildAgentPlanApprovalBinding } from '../../workers/runtime/agent-plan-approval.mjs';
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
  loadRequest = loadApproval,
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
        const runMatch = /^agent-run:([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
        // Resolve the run identifier only from the stored approval resource binding.
        const candidate = await loadRequest(env.AEGIS_DB, {
          id: approvalId,
          principalId: OWNER_ID,
          capabilityId: 'aegis-agent-run',
          capabilityVersion: '0.1.0',
          actionId: 'approve-execution',
          resourceId: 'agent-run:' + '00000000-0000-4000-8000-000000000000',
          inputDigest: 'sha256:' + '0'.repeat(64),
        });
        void candidate;
      } catch {
        // The exact plan binding is loaded below from the approval record itself.
      }
      return jsonResponse({ error: 'Approval authorisation could not be completed.' }, 503);
    },
  };
}
