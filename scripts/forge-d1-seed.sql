INSERT INTO forge_candidates (
  id, owner_id, source_type, source_url, version,
  licence_identifier, licence_review, decision, status,
  capabilities_json, dependencies_json, evidence_json, metadata_json,
  created_at, updated_at
) VALUES (
  'forge-smoke', 'owner', 'repository', 'https://github.com/example/repo',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'NOASSERTION', 'review-required', 'unassessed', 'inspected',
  '[]', '[]', '[{"url":"https://github.com/example/repo","note":"Pinned source tree reviewed"}]',
  '{"fullName":"example/repo","description":"source metadata"}',
  '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'
);

INSERT INTO forge_knowledge_records (
  id, owner_id, title, domain, knowledge_type, summary, evidence_level, status,
  sources_json, limitations_json, applicable_capabilities_json,
  created_at, updated_at
) VALUES (
  'knowledge-smoke', 'owner', 'Reproducible coding agent evaluation',
  'coding-agents', 'benchmark',
  'Evaluate coding agents against reproducible repository tasks and regression suites.',
  'high', 'draft',
  '[{"url":"https://example.org/paper","title":"Evaluation paper","attribution":"Example authors"}]',
  '["Benchmark scores do not guarantee production reliability"]',
  '["benchmark.compare","code.test"]',
  '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'
);

INSERT INTO guardian_resources (
  id, owner_id, canonical_url, source_revision, record_json,
  review_status, created_at, updated_at
) VALUES (
  'guardian-resource-smoke', 'owner', 'https://example.org/self-hosted-service',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  json_object(
    'id', 'guardian-resource-smoke',
    'name', 'Guardian D1 smoke resource',
    'canonicalUrl', 'https://example.org/self-hosted-service',
    'category', 'self-hosted-service',
    'sourceRevision', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'licence', json_object('identifier', 'MIT', 'review', 'review-required', 'evidenceUrl', NULL),
    'pricing', json_object('model', 'free', 'limits', json_array(), 'evidenceUrl', 'https://example.org/pricing', 'checkedAt', '2026-11-17T12:00:00.000Z'),
    'hosting', json_object('mode', 'self-hosted', 'requirements', json_array('Linux host')),
    'limitations', json_array('Operator maintenance required')
  ),
  'draft', '2026-11-17T12:00:00.000Z', '2026-11-17T12:00:00.000Z'
);


INSERT INTO learning_paths (
  id, owner_id, path_id, version, graph_digest, graph_json, created_at
) VALUES (
  'learning-path-assessment-smoke', 'owner', 'assessment-smoke-path', '1.0.0',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  json_object(
    'id', 'assessment-smoke-path',
    'version', '1.0.0',
    'title', 'Assessment smoke path',
    'description', 'A minimal D1 integrity test path.',
    'nodes', json_array(json_object(
      'id', 'assessment-smoke-node',
      'title', 'Smoke node',
      'outcomes', json_array('Verify assessment integrity'),
      'prerequisites', json_array(),
      'difficulty', 'beginner',
      'sourceRefs', json_array('https://example.org/learning'),
      'contentLicenseStatus', 'link-only'
    ))
  ),
  '2026-11-17T12:00:00.000Z'
);

INSERT INTO learning_assessments (
  id, owner_id, assessment_id, version, path_id, path_version,
  node_id, assessment_digest, assessment_json, created_at
) VALUES (
  'learning-assessment-smoke', 'owner', 'assessment-smoke-check', '1.0.0',
  'assessment-smoke-path', '1.0.0', 'assessment-smoke-node',
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  json_object(
    'id', 'assessment-smoke-check',
    'version', '1.0.0',
    'pathId', 'assessment-smoke-path',
    'pathVersion', '1.0.0',
    'nodeId', 'assessment-smoke-node',
    'title', 'Assessment smoke check',
    'passPercent', 80,
    'questions', json_array(json_object(
      'id', 'q1',
      'prompt', 'Which option is correct?',
      'options', json_array('A', 'B', 'C', 'D'),
      'points', 1,
      'correctOption', 'b'
    ))
  ),
  '2026-11-17T12:01:00.000Z'
);


INSERT INTO learning_assessment_attempts (
  id, owner_id, assessment_id, assessment_version, path_id, path_version,
  node_id, assessment_digest, result_json, score_percent,
  passed, mastery_verified, occurred_at
) VALUES (
  'learning-attempt-smoke', 'owner', 'assessment-smoke-check', '1.0.0',
  'assessment-smoke-path', '1.0.0', 'assessment-smoke-node',
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  json_object(
    'attemptId', 'learning-attempt-smoke',
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
  100, 1, 0, '2026-11-17T12:02:00.000Z'
);
