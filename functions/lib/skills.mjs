const SOURCE = Object.freeze({
  repository: 'obra/superpowers',
  url: 'https://github.com/obra/superpowers',
  license: 'MIT',
  importedAt: '2026-11-15',
});

const DEFINITIONS = [
  {
    id: 'brainstorming', name: 'Brainstorming', category: 'planning',
    description: 'Clarify the real goal and compare sensible approaches before non-trivial creative work.',
    upstreamCommit: '9eb0edc7fedf26e1d3e2f3f223e5bcc5058aed6a',
    triggers: ['design', 'brainstorm', 'new feature', 'new functionality', 'build an app', 'create a system'],
    guidance: 'First establish the user goal, constraints and success criteria. Inspect existing project context before asking questions. For non-trivial work, identify viable approaches, recommend one with reasons, then capture a concise design before implementation. Do not reopen decisions already made.',
  },
  {
    id: 'writing-plans', name: 'Writing Plans', category: 'planning',
    description: 'Turn multi-step requirements into small, verifiable implementation tasks.',
    upstreamCommit: '4cf0275d88d67aa4ef09f4bbca9970ed6ff74a00',
    triggers: ['implementation plan', 'multi-step', 'architecture', 'break this down', 'roadmap', 'technical plan'],
    guidance: 'Before multi-step implementation, map files and boundaries, then write bite-sized tasks. Each task names exact files, interfaces, test assertions and expected outcomes. Prefer the smallest working change, follow repository conventions, use TDD and commit coherent steps.',
  },
  {
    id: 'executing-plans', name: 'Executing Plans', category: 'engineering',
    description: 'Execute an approved plan sequentially, recording decisions and evidence.',
    upstreamCommit: 'ea23196d745043eefb0287387112825d2ca99f05',
    triggers: ['execute plan', 'implement the plan', 'carry out the plan', 'continue implementation'],
    guidance: 'Follow the approved plan task by task. Keep a concise progress ledger, prove each behavior with tests, and record any necessary deviation with its reason and risk. Continue without unnecessary check-ins. Stop before destructive, security-sensitive or externally irreversible actions.',
  },
  {
    id: 'test-driven-development', name: 'Test-Driven Development', category: 'engineering',
    description: 'Use a verified red-green-refactor cycle for behavior changes.',
    upstreamCommit: '46838cc9e893c06259e3bdad0fc2425b36242f15',
    triggers: ['implement', 'implementation', 'write code', 'feature', 'bug fix', 'regression', 'tests', 'test failure'],
    guidance: 'RED: write a focused test for the required behavior and run it to confirm it fails for the right reason. GREEN: implement the smallest change that passes. REFACTOR: improve structure while keeping tests green. Run the repository-defined focused and full test suites; never claim a test passed unless its output was observed.',
  },
  {
    id: 'systematic-debugging', name: 'Systematic Debugging', category: 'engineering',
    description: 'Find and prove root causes before changing code.',
    upstreamCommit: '62fc752aaef59a8bbed5d305f4cadc60f8ae07ed',
    triggers: ['bug', 'broken', 'error', 'failing', 'failure', 'unexpected', 'does not work', 'debug'],
    guidance: 'Investigate before fixing: read the full error, reproduce the behavior, inspect recent changes and gather evidence at component boundaries. State the most likely root cause only when supported. Add a regression test, make the minimal fix, then verify the original failure and full suite.',
  },
  {
    id: 'verification-before-completion', name: 'Verification Before Completion', category: 'quality',
    description: 'Require fresh evidence before reporting completion or success.',
    upstreamCommit: '7d45333cc4a49c57a80df6c1fe2fa777a207afbc',
    triggers: ['complete', 'finished', 'done', 'release', 'deploy', 'merge', 'pull request', 'verify'],
    guidance: 'For every completion claim, identify the command or observable result that proves it, run it now, inspect the complete output and exit status, and report the actual evidence. Distinguish implemented, tested, merged and deployed states. Never infer success from an attempted action.',
  },
  {
    id: 'requesting-code-review', name: 'Requesting Code Review', category: 'quality',
    description: 'Review major changes against requirements before integration.',
    upstreamCommit: '68d338a58ecdd8b77bfbb519b781ef223dbbb842',
    triggers: ['review', 'pull request', 'before merging', 'security review', 'major feature'],
    guidance: 'Review the diff against the requirements and tests. Look for correctness, security boundaries, missing edge cases, maintainability and scope creep. Fix critical and important findings before integration; document lower-priority follow-ups. A review is evidence, not a substitute for tests.',
  },
  {
    id: 'writing-skills', name: 'Writing Skills', category: 'meta',
    description: 'Create and improve reusable skills using testable behavioral criteria.',
    upstreamCommit: '09d76b79dd4080fe4dcc9bfb3c54d05dbff8a563',
    triggers: ['create a skill', 'write a skill', 'skill registry', 'skills tree', 'improve skills', 'new capability'],
    guidance: 'Define a skill by its trigger, intended outcome, prerequisites, workflow, boundaries and verification criteria. Test whether it changes behavior in representative scenarios. Keep instructions concise and portable. Store provenance, version, licence and evaluation status; never turn untrusted source text into executable permissions.',
  },
  {
    id: 'using-git-worktrees', name: 'Using Git Worktrees', category: 'engineering',
    description: 'Isolate parallel or risky development from the active working branch.',
    upstreamCommit: '1381dacb3516b94382dd6ec736ede21ee8ede2b3',
    triggers: ['parallel development', 'isolated branch', 'worktree', 'separate feature branch'],
    guidance: 'Check whether the current environment already isolates work. Use a dedicated feature branch or worktree for changes that should not affect the current task. Confirm the base branch and preserve existing user changes. Do not merge or publish without the required authorisation.',
  },
  {
    id: 'finishing-a-development-branch', name: 'Finishing a Development Branch', category: 'delivery',
    description: 'Verify branch work and prepare a safe integration decision.',
    upstreamCommit: 'fa8aecaf8813f1b19d19996f7957d1b0121f2d9c',
    triggers: ['finish branch', 'integrate branch', 'merge branch', 'ready to merge', 'create pull request'],
    guidance: 'First run the full test suite and inspect the final diff. Confirm the intended base branch and identify whether the work is committed and pushed. Report the available integration path clearly. Never merge, publish or delete branches merely because implementation appears complete.',
  },
];

const SKILLS = Object.freeze(DEFINITIONS.map((item) => Object.freeze({
  ...item,
  source: SOURCE,
  status: 'available',
  execution: 'guidance-only',
  permissions: Object.freeze([]),
})));

export function listSkills() {
  return SKILLS.map(({ id, name, category, description, source, status, execution, permissions, upstreamCommit }) => ({
    id, name, category, description, source: { ...source, commit: upstreamCommit }, status, execution, permissions: [...permissions],
  }));
}

export function selectSkills(prompt, limit = 4) {
  if (typeof prompt !== 'string' || !prompt.trim()) return [];
  const normalized = prompt.toLowerCase();
  const matches = SKILLS.map((skill) => ({
    skill,
    score: skill.triggers.reduce((score, trigger) => score + (normalized.includes(trigger) ? 1 : 0), 0),
  })).filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.skill.id.localeCompare(b.skill.id))
    .slice(0, Math.max(0, Math.min(4, Number.isInteger(limit) ? limit : 4)));
  return matches.map(({ skill }) => ({ id: skill.id, name: skill.name, category: skill.category }));
}

export function getSkillGuidance(id) {
  if (typeof id !== 'string') return null;
  return SKILLS.find((skill) => skill.id === id)?.guidance ?? null;
}

export function buildSkillContext(prompt) {
  return selectSkills(prompt).map(({ id, name }) => ({ id, name, guidance: getSkillGuidance(id) }));
}
