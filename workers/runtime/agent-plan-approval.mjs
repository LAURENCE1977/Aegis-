import { digestCanonicalInput } from '../../functions/lib/canonical-input.mjs';
import { getCapabilityManifest } from '../../functions/lib/capability-registry.mjs';

const RUN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRINCIPAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_APPROVAL_TTL_MS = 15 * 60 * 1000;

/**
 * Bind a human approval to the complete, canonical plan rather than to a
 * mutable run ID or a free-form description. This does not authorize or start
 * execution; Sentinel must still consume a matching one-time approval later.
 */
export async function buildAgentPlanApprovalBinding(plan, principalId, now = Date.now()) {
  if (typeof principalId !== 'string' || !PRINCIPAL_PATTERN.test(principalId)) {
    throw new TypeError('Invalid approval principal.');
  }
  if (!Number.isFinite(now)) throw new TypeError('Invalid approval clock.');
  if (!plan || typeof plan !== 'object' || Array.isArray(plan) ||
      typeof plan.runId !== 'string' || !RUN_ID_PATTERN.test(plan.runId)) {
    throw new TypeError('Invalid agent run identifier.');
  }
  if (plan.execution !== 'plan-only' || plan.requiresHumanApprovalBeforeExecution !== true) {
    throw new TypeError('Only human-gated plan-only runs can request approval.');
  }
  if (!Array.isArray(plan.steps) || plan.steps.length < 1 || plan.steps.length > 5 ||
      plan.steps.some((step) => !step || typeof step !== 'object' ||
        step.status !== 'planned' || !Array.isArray(step.tools) || step.tools.length !== 0)) {
    throw new TypeError('Agent plan steps must be planned and contain no tools.');
  }
  if (!plan.safety || plan.safety.toolsInvoked !== false ||
      plan.safety.externalEffects !== false ||
      plan.safety.sentinelRequiredForExecution !== true ||
      plan.safety.approvalRequiredForProtectedActions !== true) {
    throw new TypeError('Agent plan safety guarantees are not satisfied.');
  }

  const manifest = getCapabilityManifest('aegis-agent-run');
  const action = manifest?.actions?.find((entry) => entry.id === 'approve-execution');
  if (!manifest || manifest.status !== 'approved' || !action ||
      action.effect !== 'execute' || action.risk !== 'critical' ||
      action.approval !== 'human-always' ||
      !action.requiredScopes.includes('aegis:agent-run:execute')) {
    throw new Error('Registered agent execution capability is unavailable or unsafe.');
  }

  const inputDigest = await digestCanonicalInput(plan);
  return {
    principalId,
    capabilityId: manifest.id,
    capabilityVersion: manifest.version,
    actionId: action.id,
    resourceId: 'agent-run:' + plan.runId,
    operationSummary: 'Approve future execution of agent run ' + plan.runId,
    connectionId: null,
    inputDigest,
    requestedBy: principalId,
    expiresAt: new Date(now + MAX_APPROVAL_TTL_MS).toISOString(),
  };
}
