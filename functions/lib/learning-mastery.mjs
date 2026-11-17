const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)$/;
const ANSWER_PATTERN = /^[a-d]$/;
const MAX_QUESTIONS = 50;

function exactObject(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !keys.includes(key)) ||
      !keys.every(key => Object.hasOwn(value, key))) {
    throw new TypeError('Invalid ' + label + ' fields');
  }
}

export function validateLearningAssessment(assessment) {
  exactObject(assessment, [
    'id', 'version', 'pathId', 'pathVersion', 'nodeId', 'passPercent', 'questions',
  ], 'Learning Assessment');
  for (const field of ['id', 'pathId', 'nodeId']) {
    if (typeof assessment[field] !== 'string' || !ID_PATTERN.test(assessment[field])) {
      throw new TypeError('Invalid Learning Assessment ' + field);
    }
  }
  for (const field of ['version', 'pathVersion']) {
    if (typeof assessment[field] !== 'string' || !VERSION_PATTERN.test(assessment[field])) {
      throw new TypeError('Invalid Learning Assessment ' + field);
    }
  }
  if (!Number.isInteger(assessment.passPercent) || assessment.passPercent < 1 || assessment.passPercent > 100) {
    throw new TypeError('Invalid Learning Assessment pass threshold');
  }
  if (!Array.isArray(assessment.questions) || assessment.questions.length < 1 ||
      assessment.questions.length > MAX_QUESTIONS) {
    throw new TypeError('Learning Assessment requires 1 to 50 questions');
  }
  const ids = new Set();
  for (const question of assessment.questions) {
    exactObject(question, ['id', 'points', 'correctOption'], 'Learning Assessment question');
    if (typeof question.id !== 'string' || !ID_PATTERN.test(question.id) || ids.has(question.id)) {
      throw new TypeError('Invalid or duplicate Learning Assessment question identifier');
    }
    ids.add(question.id);
    if (!Number.isInteger(question.points) || question.points < 1 || question.points > 10) {
      throw new TypeError('Invalid Learning Assessment question points');
    }
    if (typeof question.correctOption !== 'string' || !ANSWER_PATTERN.test(question.correctOption)) {
      throw new TypeError('Invalid Learning Assessment correct option');
    }
  }
  return true;
}

export function scoreLearningAttempt(assessment, answers) {
  validateLearningAssessment(assessment);
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new TypeError('Invalid Learning Assessment answers');
  }
  const questionIds = assessment.questions.map(question => question.id);
  const answerIds = Object.keys(answers);
  if (answerIds.length !== questionIds.length ||
      answerIds.some(id => !questionIds.includes(id))) {
    throw new TypeError('Every Learning Assessment question requires exactly one answer');
  }
  let earned = 0;
  let possible = 0;
  for (const question of assessment.questions) {
    const answer = answers[question.id];
    if (typeof answer !== 'string' || !ANSWER_PATTERN.test(answer)) {
      throw new TypeError('Invalid Learning Assessment answer');
    }
    possible += question.points;
    if (answer === question.correctOption) earned += question.points;
  }
  const scorePercent = Math.round((earned / possible) * 100);
  return Object.freeze({
    assessmentId: assessment.id,
    assessmentVersion: assessment.version,
    pathId: assessment.pathId,
    pathVersion: assessment.pathVersion,
    nodeId: assessment.nodeId,
    earnedPoints: earned,
    possiblePoints: possible,
    scorePercent,
    passed: scorePercent >= assessment.passPercent,
    masteryVerified: false,
  });
}
