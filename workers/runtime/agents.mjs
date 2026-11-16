const MAX_OBJECTIVE_LENGTH = 2000;
const ALLOWED_SPECIALISTS = Object.freeze(['researcher', 'planner', 'engineer', 'security', 'reviewer']);
const DEFAULT_SPECIALISTS = Object.freeze(['researcher', 'engineer', 'reviewer']);

export function validateAgentRunSubmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Agent run submission must be an object.');
  }
  const keys = Object.keys(input);
  if (keys.some(key => !['objective', 'specialists'].includes(key))) {
    throw new TypeError('Unexpected agent run submission fields.');
  }
  if (typeof input.objective !== 'string') throw new TypeError('Objective must be text.');
  const objective = input.objective.trim();
  if (!objective || objective.length > MAX_OBJECTIVE_LENGTH ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(objective)) {
    throw new TypeError('Objective must contain 1–2000 safe characters.');
  }
  const specialists = input.specialists === undefined ? [...DEFAULT_SPECIALISTS] : input.specialists;
  if (!Array.isArray(specialists) || specialists.length < 1 || specialists.length > ALLOWED_SPECIALISTS.length) {
    throw new TypeError('Select between one and five known specialists.');
  }
  if (specialists.some(role => typeof role !== 'string' || !ALLOWED_SPECIALISTS.includes(role)) ||
      new Set(specialists).size !== specialists.length) {
    throw new TypeError('Specialists must be unique known AEGIS roles.');
  }
  return { objective, specialists: [...specialists] };
}

export function createAgentPlan(submission, metadata = {}) {
  if (!submission || typeof submission.objective !== 'string' ||
      !Array.isArray(submission.specialists) || submission.specialists.length === 0 ||
      submission.specialists.some(role => !ALLOWED_SPECIALISTS.includes(role)) ||
      new Set(submission.specialists).size !== submission.specialists.length) {
    throw new TypeError('A validated agent run submission is required.');
  }
  if (typeof metadata.runId !== 'string' || !/^[0-9a-f-]{36}$/i.test(metadata.runId) ||
      typeof metadata.createdAt !== 'string' || !Number.isFinite(Date.parse(metadata.createdAt))) {
    throw new TypeError('Valid run metadata is required.');
  }
  const sequence = ['researcher', 'planner', 'engineer', 'security', 'reviewer'];
  const ordered = submission.specialists.slice().sort((a, b) => sequence.indexOf(a) - sequence.indexOf(b));
  return {
    runId: metadata.runId,
    objective: submission.objective,
    createdAt: new Date(metadata.createdAt).toISOString(),
    execution: 'plan-only',
    requiresHumanApprovalBeforeExecution: true,
    steps: ordered.map((specialist, index) => ({
      id: metadata.runId + ':' + String(index + 1),
      specialist,
      status: 'planned',
      tools: [],
      output: null,
    })),
    safety: {
      toolsInvoked: false,
      externalEffects: false,
      sentinelRequiredForExecution: true,
      approvalRequiredForProtectedActions: true,
    },
  };
}

export const AGENT_SPECIALISTS = ALLOWED_SPECIALISTS;
