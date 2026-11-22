INSERT INTO model_usage_quota_windows
  (id, provider_id, model_id, unit_kind, window_start, window_end, limit_units, source_url, verified_at, status, created_at, updated_at)
VALUES
  ('quota-smoke', 'workers-ai', 'model-smoke', 'neurons',
   '2026-11-22T00:00:00.000Z', '2026-11-23T00:00:00.000Z', 100,
   'https://developers.cloudflare.com/workers-ai/', '2026-11-22T00:00:00.000Z', 'enabled',
   '2026-11-22T01:00:00.000Z', '2026-11-22T01:00:00.000Z');

-- First reservation consumes 70 of 100 units.
INSERT INTO model_usage_reservations
  (id, idempotency_key, principal_id, project_id, quota_window_id, reserved_units, actual_units, status, created_at, updated_at)
SELECT 'reservation-smoke-1', 'request-smoke-1', 'owner-smoke', NULL, w.id, 70, NULL, 'reserved',
       '2026-11-22T01:00:00.000Z', '2026-11-22T01:00:00.000Z'
FROM model_usage_quota_windows w
WHERE w.id = 'quota-smoke' AND w.status = 'enabled'
  AND (SELECT COALESCE(SUM(CASE WHEN status = 'reserved' THEN reserved_units WHEN status = 'settled' THEN actual_units ELSE 0 END), 0)
       FROM model_usage_reservations WHERE quota_window_id = w.id) + 70 <= w.limit_units;

-- Second reservation would exceed the 100-unit limit and must insert nothing.
INSERT INTO model_usage_reservations
  (id, idempotency_key, principal_id, project_id, quota_window_id, reserved_units, actual_units, status, created_at, updated_at)
SELECT 'reservation-smoke-2', 'request-smoke-2', 'owner-smoke', NULL, w.id, 31, NULL, 'reserved',
       '2026-11-22T01:00:00.000Z', '2026-11-22T01:00:00.000Z'
FROM model_usage_quota_windows w
WHERE w.id = 'quota-smoke' AND w.status = 'enabled'
  AND (SELECT COALESCE(SUM(CASE WHEN status = 'reserved' THEN reserved_units WHEN status = 'settled' THEN actual_units ELSE 0 END), 0)
       FROM model_usage_reservations WHERE quota_window_id = w.id) + 31 <= w.limit_units;

INSERT INTO model_usage_events (event_id, reservation_id, event_type, detail_json, created_at)
VALUES ('reserve:reservation-smoke-1', 'reservation-smoke-1', 'reserved', '{"reservedUnits":70,"unitKind":"neurons"}', '2026-11-22T01:00:00.000Z');

SELECT CASE WHEN
  (SELECT COUNT(*) FROM model_usage_reservations WHERE quota_window_id = 'quota-smoke') = 1
  AND (SELECT SUM(reserved_units) FROM model_usage_reservations WHERE quota_window_id = 'quota-smoke') = 70
THEN 'PASS' ELSE 'FAIL' END AS quota_reservation_check;
