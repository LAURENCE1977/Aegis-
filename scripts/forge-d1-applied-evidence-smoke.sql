INSERT INTO learning_applied_task_evidence (
  id, owner_id, path_id, path_version, node_id,
  artifact_digest, byte_length, media_type, submitted_at
) VALUES (
  'evidence-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'owner',
  'assessment-smoke-path', '1.0.0', 'assessment-smoke-node',
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  128, 'application/pdf', '2026-11-19T08:00:00.000Z'
);

SELECT event_type, evidence_id
FROM learning_applied_task_evidence_events
WHERE evidence_id = 'evidence-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
ORDER BY occurred_at ASC;
