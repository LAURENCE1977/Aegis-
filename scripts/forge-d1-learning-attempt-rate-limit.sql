INSERT INTO learning_assessment_attempts (
  id, owner_id, assessment_id, assessment_version, path_id, path_version,
  node_id, assessment_digest, result_json, score_percent,
  passed, mastery_verified, occurred_at
) VALUES (
  'learning-attempt-too-soon', 'owner', 'assessment-smoke-check', '1.0.0',
  'assessment-smoke-path', '1.0.0', 'assessment-smoke-node',
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  json_object(
    'attemptId', 'learning-attempt-too-soon',
    'assessmentId', 'assessment-smoke-check',
    'assessmentVersion', '1.0.0',
    'pathId', 'assessment-smoke-path',
    'pathVersion', '1.0.0',
    'nodeId', 'assessment-smoke-node',
    'earnedPoints', 1,
    'possiblePoints', 1,
    'scorePercent', 100,
    'passed', json('true'),
    'masteryVerified', json('false')
  ),
  100, 1, 0, '2026-11-17T12:02:10.000Z'
);
