import { evaluateCapabilityPolicy } from './capability-policy.mjs';
import { evaluateIntegrationToolPreflight } from './integration-tool-preflight.mjs';

function auditEvent(request, type, reasonCode, now) {
  return {
    invocationId: request.invocationId,
    type,
    principalId: request.principalId,
    capabilityId: request.manifest.id,
    capabilityVersion: request.manifest.version,
    actionId: request.actionId,
    resourceId: request.resourceId,
    inputDigest: request.inputDigest,
    reasonCode,
    occurredAt: new Date(now).toISOString(),
  };
}

function validText(value, max = 256) {
  return typeof value === 'string' && value.trim().length > 0 &&
    value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}

async function recordDenied(request, dependencies, reasonCode, now) {
  try {
    await dependencies.recordAudit(auditEvent(request, 'invocation_denied', reasonCode, now));
  } catch {
    return { allowed: false, reasonCode: 'AUDIT_UNAVAILABLE' };
  }
  return { allowed: false, reasonCode };
}

/**
 * The single AEGIS mediation point between an agent and a capability adapter.
 * Dependencies are injected so storage, policy and execution remain replaceable.
 * This function never resolves secret values and never places payloads in audit.
 */
export async function runSentinelInvocation(request, dependencies = {}) {
  const now = request?.now ?? Date.now();
  if (!request || !validText(request.invocationId, 128) ||
      !validText(request.principalId, 512) || !validText(request.resourceId) ||
      !validText(request.actionId, 128) || !validText(request.inputDigest, 128) ||
      !request.manifest || !Number.isFinite(now)) {
    return { allowed: false, reasonCode: 'INVALID_INVOCATION' };
  }

  const required = ['loadGrant', 'loadConnection', 'loadApproval', 'reserveRateLimit', 'recordAudit', 'execute'];
  if (required.some((name) => typeof dependencies[name] !== 'function') ||
      typeof dependencies.registryLookup !== 'function') {
    return { allowed: false, reasonCode: 'POLICY_CONTEXT_UNAVAILABLE' };
  }

  let grant;
  let connection;
  let approval = null;
  let integrationContext = null;
  let decision;
  try {
    [grant, connection] = await Promise.all([
      dependencies.loadGrant({
        principalId: request.principalId,
        capabilityId: request.manifest.id,
        capabilityVersion: request.manifest.version,
        resourceId: request.resourceId,
      }),
      dependencies.loadConnection({
        principalId: request.principalId,
        providerId: request.manifest.provider?.id,
      }),
    ]);
    const action = request.manifest.actions?.find((item) => item.id === request.actionId);
    if (request.integrationTool !== undefined && request.integrationTool !== null) {
      const integrationTool = request.integrationTool;
      if (!integrationTool || typeof integrationTool !== 'object' || Array.isArray(integrationTool) ||
          Object.keys(integrationTool).some((key) => !['integrationId', 'connectionKey', 'toolSlug'].includes(key)) ||
          !validText(integrationTool.integrationId, 128) ||
          !validText(integrationTool.connectionKey, 128) ||
          !validText(integrationTool.toolSlug, 128) ||
          typeof dependencies.loadIntegrationToolContext !== 'function') {
        return recordDenied(request, dependencies, 'POLICY_CONTEXT_UNAVAILABLE', now);
      }
      integrationContext = await dependencies.loadIntegrationToolContext({
        principalId: request.principalId,
        integrationId: integrationTool.integrationId,
        connectionKey: integrationTool.connectionKey,
      });
      const preflight = evaluateIntegrationToolPreflight({
        ...integrationContext,
        principalId: request.principalId,
        toolSlug: integrationTool.toolSlug,
        requiredScopes: action?.requiredScopes ?? [],
        now,
      });
      if (!preflight.eligible) {
        return recordDenied(request, dependencies, preflight.reason, now);
      }
    }
    if (action?.approval === 'human-always') {
      approval = await dependencies.loadApproval({
        principalId: request.principalId,
        capabilityId: request.manifest.id,
        capabilityVersion: request.manifest.version,
        actionId: request.actionId,
        resourceId: request.resourceId,
        inputDigest: request.inputDigest,
      });
    }
    decision = evaluateCapabilityPolicy({
      manifest: request.manifest,
      actionId: request.actionId,
      principalId: request.principalId,
      resourceId: request.resourceId,
      inputDigest: request.inputDigest,
      grant,
      connection,
      approval,
      budget: request.budget,
      now,
      registryLookup: dependencies.registryLookup,
    });
  } catch {
    return recordDenied(request, dependencies, 'POLICY_CONTEXT_UNAVAILABLE', now);
  }

  if (!decision.allowed) {
    return recordDenied(request, dependencies, decision.reasonCode, now);
  }

  try {
    const reserved = await dependencies.reserveRateLimit({
      principalId: request.principalId,
      capabilityId: request.manifest.id,
      actionId: request.actionId,
      requestsPerMinute: request.manifest.limits.requestsPerMinute,
      now,
    });
    if (!reserved) return recordDenied(request, dependencies, 'RATE_LIMITED', now);
  } catch {
    return recordDenied(request, dependencies, 'RATE_LIMIT_STORE_UNAVAILABLE', now);
  }

  try {
    await dependencies.recordAudit(auditEvent(request, 'invocation_policy_allowed', 'ALLOW', now));
  } catch {
    return { allowed: false, reasonCode: 'AUDIT_UNAVAILABLE' };
  }

  const action = request.manifest.actions.find((item) => item.id === request.actionId);
  if (action.approval === 'human-always') {
    if (typeof dependencies.consumeApproval !== 'function' || !approval?.id) {
      return recordDenied(request, dependencies, 'APPROVAL_CONSUMPTION_FAILED', now);
    }
    let consumed;
    try {
      consumed = await dependencies.consumeApproval({
        id: approval.id,
        principalId: request.principalId,
        capabilityId: request.manifest.id,
        capabilityVersion: request.manifest.version,
        actionId: request.actionId,
        resourceId: request.resourceId,
        operationSummary: approval.operationSummary,
        connectionId: connection?.id ?? null,
        inputDigest: request.inputDigest,
        now,
      });
    } catch {
      return recordDenied(request, dependencies, 'APPROVAL_CONSUMPTION_FAILED', now);
    }
    if (!consumed) {
      return recordDenied(request, dependencies, 'APPROVAL_CONSUMPTION_FAILED', now);
    }
  }

  try {
    await dependencies.recordAudit(auditEvent(request, 'invocation_authorized', 'ALLOW', now));
  } catch {
    return { allowed: false, reasonCode: 'AUDIT_UNAVAILABLE' };
  }

  let output;
  try {
    output = await dependencies.execute(request.input, {
      invocationId: request.invocationId,
      principalId: request.principalId,
      capabilityId: request.manifest.id,
      capabilityVersion: request.manifest.version,
      actionId: request.actionId,
      resourceId: request.resourceId,
      scopes: [...grant.scopes],
      connectionId: connection?.id ?? null,
      integrationId: integrationContext?.integration?.id ?? null,
      integrationConnectionId: integrationContext?.connection?.id ?? null,
      integrationToolSlug: request.integrationTool?.toolSlug ?? null,
      inputDigest: request.inputDigest,
    });
  } catch {
    try {
      await dependencies.recordAudit(auditEvent(request, 'invocation_failed', 'ADAPTER_EXECUTION_FAILED', Date.now()));
    } catch {
      return { allowed: true, reasonCode: 'EXECUTION_FAILED_AUDIT_UNAVAILABLE' };
    }
    return { allowed: true, reasonCode: 'EXECUTION_FAILED', error: { code: 'ADAPTER_EXECUTION_FAILED', message: 'Adapter execution failed.' } };
  }

  try {
    await dependencies.recordAudit(auditEvent(request, 'invocation_succeeded', 'SUCCESS', Date.now()));
    return { allowed: true, reasonCode: 'SUCCESS', output, auditRecorded: true };
  } catch {
    return { allowed: true, reasonCode: 'SUCCESS_AUDIT_UNAVAILABLE', output, auditRecorded: false };
  }
}
