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
