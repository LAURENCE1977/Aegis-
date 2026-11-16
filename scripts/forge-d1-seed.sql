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
