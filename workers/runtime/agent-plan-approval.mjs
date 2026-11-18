import { digestCanonicalInput } from '../../functions/lib/canonical-input.mjs';
import { getCapabilityManifest } from '../../functions/lib/capability-registry.mjs';
import { AGENT_SPECIALISTS } from './agents.mjs';

const RUN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRINCIPAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const MAX_APPROVAL_TTL_MS = 15 * 60 * 1000;
const PLAN_KEYS = ['schemaVersion', 'runId', 'objective', 'createdAt', 'execution',
  'requiresHumanApprovalBeforeExecution', 'steps', 'safety'];
const CONTEXT_KEYS = ['projectId', 'digest', 'generatedAt', 'memoryCount',
  'eventCount', 'knowledgeCount', 'knowledgeDigest', 'budget'];
const SAFETY_KEYS = ['toolsInvoked', 'externalEffects',
  'sentinelRequiredForExecution', 'approvalRequiredForProtectedActions'];
const STEP_KEYS = ['id', 'specialist', 'status', 'tools', 'output'];
const BUDGET_KEYS = ['maxChars', 'usedChars', 'estimatedTokens', 'truncated',
  'omittedEvents', 'omittedMemories'];

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key));
}

function validContext(context) {
  if (!exactKeys(context, CONTEXT_KEYS) ||
      typeof context.projectId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(context.projectId) ||
      typeof context.digest !== 'string' || !DIGEST_PATTERN.test(context.digest) ||
      typeof context.generatedAt !== 'string' || !Number.isFinite(Date.parse(context.generatedAt)) ||
      !Number.isInteger(context.memoryCount) || context.memoryCount < 0 || context.memoryCount > 50 ||
      !Number.isInteger(context.eventCount) || context.eventCount < 0 || context.eventCount > 100 ||
      !Number.isInteger(context.knowledgeCount) || context.knowledgeCount < 0 || context.knowledgeCount > 20 ||
      !(context.knowledgeDigest === null ||
        (typeof context.knowledgeDigest === 'string' && DIGEST_PATTERN.test(context.knowledgeDigest))) ||
      !exactKeys(context.budget, BUDGET_KEYS)) return false;
  const budget = context.budget;
  return Number.isInteger(budget.maxChars) && budget.maxChars >= 1000 && budget.maxChars <= 12000 &&
    Number.isInteger(budget.usedChars) && budget.usedChars >= 0 && budget.usedChars <= budget.maxChars &&
    Number.isInteger(budget.estimatedTokens) && budget.estimatedTokens >= 0 && budget.estimatedTokens <= 4000 &&
    typeof budget.truncated === 'boolean' &&
    Number.isInteger(budget.omittedEvents) && budget.omittedEvents >= 0 &&
    Number.isInteger(budget.omittedMemories) && budget.omittedMemories >= 0;
}

function validatePlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new TypeError('Agent plan must be an object.');
  }
  if (plan.schemaVersion !== '1.0') {
    throw new TypeError('Unsupported agent plan schema version.');
  }
  if (typeof plan.runId !== 'string' || !RUN_ID_PATTERN.test(plan.runId)) {
    throw new TypeError('Invalid agent run identifier.');
  }
  if (plan.execution !== 'plan-only' || plan.requiresHumanApprovalBeforeExecution !== true) {
    throw new TypeError('Only human-gated plan-only runs can request approval.');
  }
  if (typeof plan.objective !== 'string' || !plan.objective.trim() || plan.objective.length > 2000 ||
      typeof plan.createdAt !== 'string' || !Number.isFinite(Date.parse(plan.createdAt)) ||
      new Date(plan.createdAt).toISOString() !== plan.createdAt) {
    throw new TypeError('Agent run objective or creation timestamp is invalid.');
  }
  if (!exactKeys(plan, Object.hasOwn(plan, 'context') ? [...PLAN_KEYS, 'context'] : PLAN_KEYS)) {
    throw new TypeError('Agent plan has unexpected or missing fields.');
  }
  if (Object.hasOwn(plan, 'context') && !validContext(plan.context)) {
    throw new TypeError('Agent plan context is invalid.');
  }
  if (!Array.isArray(plan.steps) || plan.steps.length < 1 || plan.steps.length > 5) {
    throw new TypeError('Agent plan steps are invalid.');
  }
  const specialists = new Set();
  for (const [index, step] of plan.steps.entries()) {
    if (!step || typeof step !== 'object' || Array.isArray(step)) {
      throw new TypeError('Agent plan step must be an object.');
    }
    if (!exactKeys(step, STEP_KEYS)) {
      throw new TypeError('Agent plan step has unexpected or missing fields.');
    }
    if (step.id !== plan.runId + ':' + String(index + 1) ||
        !AGENT_SPECIALISTS.includes(step.specialist) || specialists.has(step.specialist)) {
      throw new TypeError('Agent plan step identifier or specialist is invalid.');
    }
    if (step.status !== 'planned' || !Array.isArray(step.tools) || step.tools.length !== 0) {
      throw new TypeError('Agent plan steps must be planned and contain no tools.');
    }
    if (step.output !== null) {
      throw new TypeError('Agent plan steps cannot contain pre-populated output.');
    }
    specialists.add(step.specialist);
  }
  if (!exactKeys(plan.safety, SAFETY_KEYS) ||
      plan.safety.toolsInvoked !== false ||
      plan.safety.externalEffects !== false ||
      plan.safety.sentinelRequiredForExecution !== true ||
      plan.safety.approvalRequiredForProtectedActions !== true) {
    throw new TypeError('Agent plan safety guarantees are not satisfied.');
  }
}

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
  validatePlan(plan);

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
