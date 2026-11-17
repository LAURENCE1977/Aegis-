INSERT INTO learning_assessments (
  id, owner_id, assessment_id, version, path_id, path_version,
  node_id, assessment_digest, assessment_json, created_at
) VALUES (
  'learning-assessment-invalid-node', 'owner', 'invalid-node-check', '1.0.0',
  'assessment-smoke-path', '1.0.0', 'node-not-in-path',
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  json_object(
    'id', 'invalid-node-check',
    'version', '1.0.0',
    'pathId', 'assessment-smoke-path',
    'pathVersion', '1.0.0',
    'nodeId', 'node-not-in-path',
    'title', 'Invalid node check',
    'passPercent', 80,
    'questions', json_array(json_object(
      'id', 'q1', 'prompt', 'Question?', 'options', json_array('A', 'B', 'C', 'D'),
      'points', 1, 'correctOption', 'a'
    ))
  ),
  '2026-11-17T12:02:00.000Z'
);
