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
