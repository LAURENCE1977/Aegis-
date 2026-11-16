import { getCapabilityManifest, validateCapabilityManifest } from './capability-registry.mjs';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function timestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

function deny(reasonCode) {
  return { allowed: false, reasonCode };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (isRecord(value)) {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function validContextText(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 512;
}

function validateGrant(grant, manifest, action, principalId, resourceId, now) {
  if (!isRecord(grant)) return 'GRANT_REQUIRED';
  if (grant.status === 'revoked' || grant.revokedAt) return 'GRANT_REVOKED';
  if (grant.status !== 'active') return 'GRANT_REQUIRED';
  if (grant.principalId !== principalId) return 'PRINCIPAL_MISMATCH';
  if (grant.capabilityId !== manifest.id || grant.capabilityVersion !== manifest.version) {
    return 'GRANT_MISMATCH';
  }
  if (!Array.isArray(grant.scopes) ||
      !action.requiredScopes.every((scope) => grant.scopes.includes(scope))) {
    return 'SCOPE_MISSING';
  }
  if (!Array.isArray(grant.resourceIds) || grant.resourceIds.includes('*') ||
      !grant.resourceIds.includes(resourceId)) {
    return 'RESOURCE_MISMATCH';
  }
  const expiresAt = timestamp(grant.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return 'GRANT_EXPIRED';
  return null;
}

function validateConnection(connection, manifest, principalId) {
  if (!isRecord(connection)) return 'CONNECTION_REQUIRED';
  if (connection.status !== 'active' ||
      connection.principalId !== principalId ||
      connection.providerId !== manifest.provider.id ||
      !validContextText(connection.id)) {
    return 'CONNECTION_INVALID';
  }
  return null;
}

function validateApproval(approval, manifest, action, principalId, resourceId, inputDigest, connectionId, now) {
  if (!isRecord(approval)) return 'APPROVAL_REQUIRED';
  if (approval.consumedAt) return 'APPROVAL_REPLAYED';
  const expiresAt = timestamp(approval.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return 'APPROVAL_EXPIRED';
  if (approval.status !== 'approved') return 'APPROVAL_INVALID';
  if (approval.principalId !== principalId ||
      approval.capabilityId !== manifest.id ||
      approval.capabilityVersion !== manifest.version ||
      approval.actionId !== action.id ||
      approval.resourceId !== resourceId ||
      approval.inputDigest !== inputDigest ||
      (approval.connectionId ?? null) !== connectionId) {
    return 'APPROVAL_MISMATCH';
  }
  return null;
}

function validateBudget(budget) {
  if (budget === undefined || budget === null) return null;
  if (!isRecord(budget) || !Number.isInteger(budget.remainingCalls) || budget.remainingCalls < 1) {
    return 'BUDGET_EXHAUSTED';
  }
  if (budget.remainingSpend !== undefined || budget.estimatedCost !== undefined) {
    if (!Number.isFinite(budget.remainingSpend) || budget.remainingSpend < 0 ||
        !Number.isFinite(budget.estimatedCost) || budget.estimatedCost < 0 ||
        budget.estimatedCost > budget.remainingSpend) {
      return 'BUDGET_EXHAUSTED';
    }
  }
  return null;
}

/**
 * Pure, fail-closed policy decision. This function reads supplied grant,
 * connection, approval and budget snapshots; it does not persist or consume them.
 * The caller must re-check and atomically consume a one-time approval at execution.
 */
export function evaluateCapabilityPolicy({
  manifest,
  actionId,
  principalId,
  resourceId,
  inputDigest,
  grant,
  connection = null,
  approval = null,
  budget,
  now = Date.now(),
  registryLookup = getCapabilityManifest,
} = {}) {
  try {
    validateCapabilityManifest(manifest);
  } catch {
    return deny('MANIFEST_INVALID');
  }

  if (typeof registryLookup !== 'function') return deny('CAPABILITY_NOT_REGISTERED');
  let registered;
  try { registered = registryLookup(manifest.id); } catch { return deny('CAPABILITY_NOT_REGISTERED'); }
  if (!registered) return deny('CAPABILITY_NOT_REGISTERED');
  if (canonicalJson(registered) !== canonicalJson(manifest)) return deny('MANIFEST_MISMATCH');
  if (manifest.status !== 'approved') return deny('CAPABILITY_NOT_ENABLED');
  if (!validContextText(actionId)) return deny('ACTION_NOT_FOUND');
  const action = manifest.actions.find((item) => item.id === actionId);
  if (!action) return deny('ACTION_NOT_FOUND');
  if (!validContextText(principalId) || !validContextText(resourceId) ||
      !validContextText(inputDigest) || !Number.isFinite(now)) {
    return deny('INVALID_CONTEXT');
  }

  const grantError = validateGrant(grant, manifest, action, principalId, resourceId, now);
  if (grantError) return deny(grantError);

  let connectionId = null;
  if (manifest.auth.mode === 'oauth2' || manifest.auth.mode === 'secret-reference') {
    const connectionError = validateConnection(connection, manifest, principalId);
    if (connectionError) return deny(connectionError);
    connectionId = connection.id;
  }

  if (action.approval === 'human-always') {
    const approvalError = validateApproval(
      approval, manifest, action, principalId, resourceId, inputDigest, connectionId, now,
    );
    if (approvalError) return deny(approvalError);
  }

  const budgetError = validateBudget(budget);
  if (budgetError) return deny(budgetError);

  return { allowed: true, reasonCode: 'ALLOW' };
}
