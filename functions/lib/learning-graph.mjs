const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ACTIVITY_KINDS = new Set(['exercise', 'reading', 'project', 'quiz', 'reflection']);

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, keys, label) {
  if (!isRecord(value) || Object.keys(value).length !== keys.length ||
      Object.keys(value).some((key) => !keys.includes(key))) {
    throw new TypeError('Invalid ' + label + ' fields');
  }
}

function requireText(value, label, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() ||
      value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError('Invalid learning ' + label);
  }
}

function requireId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value) || value.length > 80) {
    throw new TypeError('Invalid learning ' + label);
  }
}

function validateSourceUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) {
    throw new TypeError('Invalid learning activity source URL');
  }
  let url;
  try { url = new URL(value); }
  catch { throw new TypeError('Invalid learning activity source URL'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new TypeError('Learning activity source URL must use HTTPS without embedded credentials');
  }
}

export function validateLearningPath(path) {
  exactKeys(path, ['schemaVersion', 'id', 'title', 'description', 'concepts', 'activities'], 'path');
  if (path.schemaVersion !== 1) throw new TypeError('Unsupported learning path schema version');
  requireId(path.id, 'path identifier');
  requireText(path.title, 'title', 200);
  requireText(path.description, 'description', 1000);

  if (!Array.isArray(path.concepts) || path.concepts.length < 1 || path.concepts.length > 100) {
    throw new TypeError('Learning path must contain between 1 and 100 concepts');
  }
  if (!Array.isArray(path.activities) || path.activities.length > 200) {
    throw new TypeError('Learning path must contain at most 200 activities');
  }

  const concepts = new Map();
  for (const concept of path.concepts) {
    exactKeys(concept, ['id', 'title', 'prerequisites', 'outcomes'], 'concept');
    requireId(concept.id, 'concept identifier');
    requireText(concept.title, 'concept title', 200);
    if (concepts.has(concept.id)) throw new TypeError('Duplicate concept identifier');
    if (!Array.isArray(concept.prerequisites) || concept.prerequisites.length > 20) {
      throw new TypeError('Invalid concept prerequisites');
    }
    if (!Array.isArray(concept.outcomes) || concept.outcomes.length < 1 || concept.outcomes.length > 20) {
      throw new TypeError('Invalid concept outcomes');
    }
    const seen = new Set();
    for (const prerequisite of concept.prerequisites) {
      requireId(prerequisite, 'prerequisite identifier');
      if (seen.has(prerequisite)) throw new TypeError('Duplicate prerequisite');
      if (prerequisite === concept.id) throw new TypeError('A concept cannot depend on itself');
      seen.add(prerequisite);
    }
    for (const outcome of concept.outcomes) requireText(outcome, 'outcome', 300);
    concepts.set(concept.id, concept);
  }

  for (const concept of concepts.values()) {
    for (const prerequisite of concept.prerequisites) {
      if (!concepts.has(prerequisite)) throw new TypeError('Unknown prerequisite: ' + prerequisite);
    }
  }

  const activityIds = new Set();
  for (const activity of path.activities) {
    exactKeys(activity, ['id', 'conceptId', 'kind', 'sourceUrl', 'evidenceRequired'], 'activity');
    requireId(activity.id, 'activity identifier');
    requireId(activity.conceptId, 'activity concept identifier');
    if (activityIds.has(activity.id)) throw new TypeError('Duplicate learning activity identifier');
    activityIds.add(activity.id);
    if (!concepts.has(activity.conceptId)) throw new TypeError('Learning activity references an unknown concept');
    if (!ACTIVITY_KINDS.has(activity.kind)) throw new TypeError('Invalid learning activity kind');
    validateSourceUrl(activity.sourceUrl);
    if (typeof activity.evidenceRequired !== 'boolean') {
      throw new TypeError('Invalid learning activity evidence requirement');
    }
  }

  const state = new Map();
  function visit(id) {
    const current = state.get(id);
    if (current === 'visiting') throw new TypeError('Learning prerequisite cycle detected');
    if (current === 'visited') return;
    state.set(id, 'visiting');
    for (const prerequisite of concepts.get(id).prerequisites) visit(prerequisite);
    state.set(id, 'visited');
  }
  for (const id of concepts.keys()) visit(id);
  return true;
}

export function buildLearningSequence(path) {
  validateLearningPath(path);
  const concepts = new Map(path.concepts.map((concept) => [concept.id, concept]));
  const visited = new Set();
  const sequence = [];
  function visit(id) {
    if (visited.has(id)) return;
    for (const prerequisite of concepts.get(id).prerequisites) visit(prerequisite);
    visited.add(id);
    sequence.push(id);
  }
  for (const concept of path.concepts) visit(concept.id);
  return sequence;
}

export function getAvailableLearningConcepts(path, completedConceptIds = []) {
  validateLearningPath(path);
  if (!Array.isArray(completedConceptIds)) throw new TypeError('Completed concept identifiers must be an array');
  const known = new Set(path.concepts.map((concept) => concept.id));
  const completed = new Set();
  for (const id of completedConceptIds) {
    requireId(id, 'completed concept identifier');
    if (!known.has(id)) throw new TypeError('Unknown completed concept: ' + id);
    if (completed.has(id)) throw new TypeError('Duplicate completed concept identifier');
    completed.add(id);
  }
  return path.concepts
    .filter((concept) => !completed.has(concept.id) &&
      concept.prerequisites.every((prerequisite) => completed.has(prerequisite)))
    .map((concept) => concept.id);
}
