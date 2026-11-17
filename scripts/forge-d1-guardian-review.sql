UPDATE guardian_resources
SET review_status = 'reviewed', review_note = 'Pinned source and metadata reviewed; licence evidence remains unverified.',
    reviewer_id = 'owner', updated_at = '2026-11-17T12:01:00.000Z'
WHERE id = 'guardian-resource-smoke' AND owner_id = 'owner';

INSERT INTO guardian_resources (
  id, owner_id, canonical_url, source_revision, record_json, review_status, created_at, updated_at
) VALUES (
  'guardian-resource-accepted-smoke', 'owner', 'https://example.org/verified-service',
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  json_object(
    'id', 'guardian-resource-accepted-smoke',
    'name', 'Guardian accepted smoke resource',
    'canonicalUrl', 'https://example.org/verified-service',
    'category', 'self-hosted-service',
    'sourceRevision', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'licence', json_object('identifier', 'MIT', 'review', 'verified', 'evidenceUrl', 'https://opensource.org/license/mit/'),
    'pricing', json_object('model', 'free', 'limits', json_array(), 'evidenceUrl', 'https://example.org/pricing', 'checkedAt', '2026-11-17T12:00:00.000Z'),
    'hosting', json_object('mode', 'self-hosted', 'requirements', json_array('Linux host')),
    'limitations', json_array()
  ),
  'draft', '2026-11-17T12:00:00.000Z', '2026-11-17T12:00:00.000Z'
);

UPDATE guardian_resources
SET review_status = 'reviewed', review_note = 'Verified upstream licence and evidence URL.',
    reviewer_id = 'owner', updated_at = '2026-11-17T12:01:00.000Z'
WHERE id = 'guardian-resource-accepted-smoke';

UPDATE guardian_resources
SET review_status = 'accepted', review_note = 'Accepted after licence evidence verification.',
    reviewer_id = 'owner', updated_at = '2026-11-17T12:02:00.000Z'
WHERE id = 'guardian-resource-accepted-smoke';

UPDATE guardian_resources
SET review_status = 'archived', review_note = 'Archived for lifecycle smoke verification.',
    reviewer_id = 'owner', updated_at = '2026-11-17T12:03:00.000Z'
WHERE id = 'guardian-resource-accepted-smoke';