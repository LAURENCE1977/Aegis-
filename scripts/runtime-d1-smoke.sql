INSERT INTO experiment_records (
  principal_id, record_id, schema_version, record_digest, record_json, created_at
) VALUES (
  'principal-a', 'record-smoke', 'aegis.experiment-record.v1',
  'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '{"schemaVersion":"aegis.experiment-record.v1","id":"record-smoke","ownerId":"principal-a","recordDigest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}',
  '2026-11-20T23:00:00.000Z'
);

-- A different principal may use the same record ID without crossing namespaces.
INSERT INTO experiment_records (
  principal_id, record_id, schema_version, record_digest, record_json, created_at
) VALUES (
  'principal-b', 'record-smoke', 'aegis.experiment-record.v1',
  'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '{"schemaVersion":"aegis.experiment-record.v1","id":"record-smoke","ownerId":"principal-b","recordDigest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}',
  '2026-11-20T23:00:00.000Z'
);

INSERT INTO experiment_record_events (
  event_id, principal_id, record_id, actor_principal_id,
  event_type, record_digest, created_at
) VALUES (
  'created:principal-a:record-smoke', 'principal-a', 'record-smoke',
  'principal-a', 'created', 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '2026-11-20T23:00:00.000Z'
);

INSERT INTO experiment_record_events (
  event_id, principal_id, record_id, actor_principal_id,
  event_type, record_digest, created_at
) VALUES (
  'tombstoned:principal-a:record-smoke', 'principal-a', 'record-smoke',
  'principal-a', 'tombstoned', 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '2026-11-20T23:01:00.000Z'
);
