INSERT INTO agent_runs (
  id, objective, specialists_json, status, attempts, idempotency_key,
  plan_json, error_code, lease_until, created_at, updated_at, cancelled_at,
  project_id, context_digest, context_json
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Runtime cancellation migration smoke test',
  '["researcher"]', 'queued', 0, 'runtime-cancel-smoke',
  NULL, NULL, NULL, '2026-11-16T00:00:00.000Z',
  '2026-11-16T00:00:00.000Z', NULL,
  'project-smoke', 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
  '{"brief":{"workspace":{"id":"project-smoke"}},"digest":"sha256:0000000000000000000000000000000000000000000000000000000000000000"}'
);

INSERT INTO agent_run_steps (
  id, agent_run_id, step_index, specialist, status, attempts,
  step_json, checkpoint_json, created_at, updated_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000:1',
  '550e8400-e29b-41d4-a716-446655440000',
  1, 'researcher', 'planned', 0,
  '{"id":"550e8400-e29b-41d4-a716-446655440000:1","specialist":"researcher","tools":[]}',
  '{}', '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'
);

INSERT INTO agent_run_step_events (
  event_id, agent_run_step_id, agent_run_id, event_type, detail_json, created_at
) VALUES (
  'planned:550e8400-e29b-41d4-a716-446655440000:1',
  '550e8400-e29b-41d4-a716-446655440000:1',
  '550e8400-e29b-41d4-a716-446655440000',
  'planned', '{}', '2026-11-16T00:00:00.000Z'
);

UPDATE agent_runs
SET cancelled_at = '2026-11-16T00:01:00.000Z', updated_at = '2026-11-16T00:01:00.000Z'
WHERE id = '550e8400-e29b-41d4-a716-446655440000'
  AND status = 'queued'
  AND cancelled_at IS NULL;

UPDATE agent_run_steps
SET status = 'cancelled', lease_until = NULL, updated_at = '2026-11-16T00:01:00.000Z'
WHERE agent_run_id = '550e8400-e29b-41d4-a716-446655440000'
  AND status = 'planned';

INSERT INTO agent_run_events (
  event_id, agent_run_id, event_type, detail_json, created_at
) VALUES (
  'cancelled:550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440000',
  'cancelled', '{}', '2026-11-16T00:01:00.000Z'
);

INSERT INTO agent_run_step_events (
  event_id, agent_run_step_id, agent_run_id, event_type, detail_json, created_at
) VALUES (
  'cancelled:550e8400-e29b-41d4-a716-446655440000:1',
  '550e8400-e29b-41d4-a716-446655440000:1',
  '550e8400-e29b-41d4-a716-446655440000',
  'cancelled', '{}', '2026-11-16T00:01:00.000Z'
);
