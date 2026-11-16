INSERT INTO agent_runs (
  id, objective, specialists_json, status, attempts, idempotency_key,
  plan_json, error_code, lease_until, created_at, updated_at, cancelled_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Runtime cancellation migration smoke test',
  '["researcher"]', 'queued', 0, 'runtime-cancel-smoke',
  NULL, NULL, NULL, '2026-11-16T00:00:00.000Z',
  '2026-11-16T00:00:00.000Z', NULL
);

UPDATE agent_runs
SET cancelled_at = '2026-11-16T00:01:00.000Z', updated_at = '2026-11-16T00:01:00.000Z'
WHERE id = '550e8400-e29b-41d4-a716-446655440000'
  AND status = 'queued'
  AND cancelled_at IS NULL;

INSERT INTO agent_run_events (
  event_id, agent_run_id, event_type, detail_json, created_at
) VALUES (
  'cancelled:550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440000',
  'cancelled', '{}', '2026-11-16T00:01:00.000Z'
);
