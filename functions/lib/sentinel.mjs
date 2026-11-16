import { evaluateCapabilityPolicy } from './capability-policy.mjs';

const CONTEXT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function validContextId(value) {
  return value === undefined || value === null ||
    (typeof value === 'string' && CONTEXT_ID_PATTERN.test(value));
}

function invocationContext(request, grant = null, connection = null, approval = null, adapterReceiptId = null) {
  return {
    grantId: grant?.id ?? null,
    connectionId: connection?.id ?? null,
    approvalId: approval?.id ?? null,
    taskId: request.taskId ?? null,
    sessionId: request.sessionId ?? null,
    parentSessionId: request.parentSessionId ?? null,
    workerId: request.workerId ?? null,
    adapterReceiptId,
  };
}

function auditEvent(request, type, reasonCode, now, context = {}) {
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
    grantId: context.grantId ?? null,
    connectionId: context.connectionId ?? null,
    approvalId: context.approvalId ?? null,
    taskId: context.taskId ?? request.taskId ?? null,
    sessionId: context.sessionId ?? request.sessionId ?? null,
    parentSessionId: context.parentSessionId ?? request.parentSessionId ?? null,
    workerId: context.workerId ?? request.workerId ?? null,
    adapterReceiptId: context.adapterReceiptId ?? null,
  };
}

function validText(value, max = 256) {
  return typeof value === 'string' && value.trim().length > 0 &&
    value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}

function safeReceiptId(output) {
  const value = output && typeof output === 'object'
    ? (output.adapterReceiptId ?? output.logId)
    : null;
  return typeof value === 'string' && CONTEXT_ID_PATTERN.test(value) ? value : null;
}

async function recordDenied(request, dependencies, reasonCode, now, context = {}) {
  try {
    await dependencies.recordAudit(auditEvent(request, 'invocation_denied', reasonCode, now, context));
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
      !request.manifest || !Number.isFinite(now) ||
      !validContextId(request.taskId) || !validContextId(request.sessionId) ||
      !validContextId(request.parentSessionId) || !validContextId(request.workerId)) {
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
  let decision;
  let context = invocationContext(request);
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
    context = invocationContext(request, grant, connection, approval);
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
    return recordDenied(request, dependencies, 'POLICY_CONTEXT_UNAVAILABLE', now, context);
  }

  if (!decision.allowed) {
    return recordDenied(request, dependencies, decision.reasonCode, now, context);
  }

  try {
    const reserved = await dependencies.reserveRateLimit({
      principalId: request.principalId,
      capabilityId: request.manifest.id,
      actionId: request.actionId,
      requestsPerMinute: request.manifest.limits.requestsPerMinute,
      now,
    });
    if (!reserved) return recordDenied(request, dependencies, 'RATE_LIMITED', now, context);
  } catch {
    return recordDenied(request, dependencies, 'RATE_LIMIT_STORE_UNAVAILABLE', now, context);
  }

  try {
    await dependencies.recordAudit(auditEvent(request, 'invocation_policy_allowed', 'ALLOW', now, context));
  } catch {
    return { allowed: false, reasonCode: 'AUDIT_UNAVAILABLE' };
  }

  const action = request.manifest.actions.find((item) => item.id === request.actionId);
  if (action.approval === 'human-always') {
    if (typeof dependencies.consumeApproval !== 'function' || !approval?.id) {
      return recordDenied(request, dependencies, 'APPROVAL_CONSUMPTION_FAILED', now, context);
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
      return recordDenied(request, dependencies, 'APPROVAL_CONSUMPTION_FAILED', now, context);
    }
    if (!consumed) {
      return recordDenied(request, dependencies, 'APPROVAL_CONSUMPTION_FAILED', now, context);
    }
  }

  try {
    await dependencies.recordAudit(auditEvent(request, 'invocation_authorized', 'ALLOW', now, context));
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
      grantId: grant?.id ?? null,
      approvalId: approval?.id ?? null,
      taskId: request.taskId ?? null,
      sessionId: request.sessionId ?? null,
      parentSessionId: request.parentSessionId ?? null,
      workerId: request.workerId ?? null,
      inputDigest: request.inputDigest,
    });
  } catch {
    try {
      await dependencies.recordAudit(auditEvent(
        request, 'invocation_failed', 'ADAPTER_EXECUTION_FAILED', Date.now(), context,
      ));
    } catch {
      return { allowed: true, reasonCode: 'EXECUTION_FAILED_AUDIT_UNAVAILABLE' };
    }
    return { allowed: true, reasonCode: 'EXECUTION_FAILED', error: { code: 'ADAPTER_EXECUTION_FAILED', message: 'Adapter execution failed.' } };
  }

  const completedContext = {
    ...context,
    adapterReceiptId: safeReceiptId(output),
  };
  try {
    await dependencies.recordAudit(auditEvent(
      request, 'invocation_succeeded', 'SUCCESS', Date.now(), completedContext,
    ));
    return { allowed: true, reasonCode: 'SUCCESS', output, auditRecorded: true };
  } catch {
    return { allowed: true, reasonCode: 'SUCCESS_AUDIT_UNAVAILABLE', output, auditRecorded: false };
  }
}
