const MAX_OBJECTIVE_LENGTH = 2000;
const MAX_CRITERIA = 8;
const MAX_CRITERION_LENGTH = 240;
const ALLOWED_PRIORITIES = Object.freeze([
  'balanced',
  'lowest_cost',
  'fastest',
  'highest_reliability',
]);
const ALLOWED_SPECIALISTS = Object.freeze(['researcher', 'planner', 'engineer', 'security', 'reviewer']);
const DEFAULT_SPECIALISTS = Object.freeze(['researcher', 'engineer', 'reviewer']);

function validateAcceptanceCriteria(value = []) {
  if (!Array.isArray(value) || value.length > MAX_CRITERIA) {
    throw new TypeError('Acceptance criteria must be a list of up to eight items.');
  }
  const criteria = value.map((item) => {
    if (typeof item !== 'string') throw new TypeError('Acceptance criteria must be text.');
    const normalized = item.trim();
    if (!normalized || normalized.length > MAX_CRITERION_LENGTH ||
        /[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/.test(normalized)) {
      throw new TypeError('Each acceptance criterion must contain 1–240 safe characters.');
    }
    return normalized;
  });
  if (new Set(criteria).size !== criteria.length) {
    throw new TypeError('Acceptance criteria must be unique.');
  }
  return criteria;
}

export function validateAgentRunSubmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Agent run submission must be an object.');
  }
  const keys = Object.keys(input);
  if (keys.some((key) => !['objective', 'specialists', 'acceptanceCriteria', 'priority'].includes(key))) {
    throw new TypeError('Unexpected agent run submission fields.');
  }
  if (typeof input.objective !== 'string') throw new TypeError('Objective must be text.');
  const objective = input.objective.trim();
  if (!objective || objective.length > MAX_OBJECTIVE_LENGTH || /[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/.test(objective)) {
    throw new TypeError('Objective must contain 1–2000 safe characters.');
  }
  const specialists = input.specialists === undefined ? [...DEFAULT_SPECIALISTS] : input.specialists;
  if (!Array.isArray(specialists) || specialists.length < 1 || specialists.length > ALLOWED_SPECIALISTS.length) {
    throw new TypeError('Select between one and five known specialists.');
  }
  if (specialists.some((role) => typeof role !== 'string' || !ALLOWED_SPECIALISTS.includes(role)) ||
      new Set(specialists).size !== specialists.length) {
    throw new TypeError('Specialists must be unique known AEGIS roles.');
  }
  const acceptanceCriteria = validateAcceptanceCriteria(input.acceptanceCriteria);
  const priority = input.priority === undefined ? 'balanced' : input.priority;
  if (!ALLOWED_PRIORITIES.includes(priority)) {
    throw new TypeError('Priority must be balanced, lowest_cost, fastest or highest_reliability.');
  }
  return { objective, specialists: [...specialists], acceptanceCriteria, priority };
}

function buildApproaches() {
  return [
    {
      id: 'lean',
      name: 'Lean first pass',
      focus: 'lowest cost and smallest useful scope',
      tradeoffs: ['Lower initial effort and fewer dependencies', 'May require another pass for broader coverage'],
      sequence: 'Complete the smallest verifiable slice before expanding scope.',
      execution: 'plan-only',
      tools: [],
    },
    {
      id: 'parallel_discovery',
      name: 'Parallel discovery',
      focus: 'shorter elapsed time',
      tradeoffs: ['Independent analysis can progress together', 'Requires coordination and can increase model or tool usage'],
      sequence: 'Separate independent research and review work, then reconcile findings before implementation.',
      execution: 'plan-only',
      tools: [],
    },
    {
      id: 'staged',
      name: 'Staged assurance',
      focus: 'reliability and evidence',
      tradeoffs: ['Clear checkpoints and stronger verification', 'Usually takes longer than a minimal first pass'],
      sequence: 'Establish evidence, plan the change, implement in bounded steps, then independently review.',
      execution: 'plan-only',
      tools: [],
    },
  ];
}

const RECOMMENDED_APPROACH = Object.freeze({
  balanced: 'staged',
  lowest_cost: 'lean',
  fastest: 'parallel_discovery',
  highest_reliability: 'staged',
});

export function createAgentPlan(submission, metadata = {}) {
  if (!submission || !Array.isArray(submission.specialists) || submission.specialists.length === 0) {
    throw new TypeError('A validated agent run submission is required.');
  }
  const validated = validateAgentRunSubmission(submission);
  if (typeof metadata.runId !== 'string' || !metadata.runId.trim() ||
      typeof metadata.createdAt !== 'string' || !Number.isFinite(Date.parse(metadata.createdAt))) {
    throw new TypeError('Valid run metadata is required.');
  }
  const sequence = ['researcher', 'planner', 'engineer', 'security', 'reviewer'];
  const ordered = validated.specialists.slice().sort((a, b) => sequence.indexOf(a) - sequence.indexOf(b));
  return {
    runId: metadata.runId,
    objective: validated.objective,
    acceptanceCriteria: [...validated.acceptanceCriteria],
    priority: validated.priority,
    createdAt: new Date(metadata.createdAt).toISOString(),
    execution: 'plan-only',
    requiresHumanApprovalBeforeExecution: true,
    recommendedApproach: RECOMMENDED_APPROACH[validated.priority],
    approaches: buildApproaches(),
    steps: ordered.map((specialist, index) => ({
      id: metadata.runId + ':' + String(index + 1),
      specialist,
      status: 'planned',
      tools: [],
      output: null,
    })),
    verification: {
      required: validated.acceptanceCriteria.length > 0,
      criteria: [...validated.acceptanceCriteria],
      completionRequiresEvidence: true,
    },
    safety: {
      toolsInvoked: false,
      externalEffects: false,
      sentinelRequiredForExecution: true,
      approvalRequiredForProtectedActions: true,
    },
  };
}

export const AGENT_SPECIALISTS = ALLOWED_SPECIALISTS;

export { runAgentCapabilityRequest } from './agent-capability-bridge.mjs';
