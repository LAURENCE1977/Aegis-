INSERT INTO device_pairing_invites
  (id, owner_id, code_hash, platform, display_name, capabilities_json, expires_at, consumed_at, revoked_at, created_by, created_at)
VALUES
  ('pairing-smoke', 'owner-smoke',
   'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
   'android', 'Smoke phone',
   '["device.status.read","aegis.jobs.observe"]',
   '2026-11-23T02:00:00.000Z', '2026-11-23T01:00:00.000Z', NULL,
   'owner-smoke', '2026-11-23T01:00:00.000Z');

INSERT INTO devices
  (id, invite_id, owner_id, platform, display_name, token_hash, token_version,
   capabilities_json, status, last_seen_at, app_version, connectivity, created_at, updated_at, revoked_at)
VALUES
  ('device-smoke', 'pairing-smoke', 'owner-smoke', 'android', 'Smoke phone',
   'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 1,
   '["device.status.read","aegis.jobs.observe"]', 'active', NULL, NULL, NULL,
   '2026-11-23T01:00:00.000Z', '2026-11-23T01:00:00.000Z', NULL);

INSERT INTO device_events (event_id, device_id, event_type, detail_json, created_at)
VALUES ('device-event-smoke', 'device-smoke', 'paired', '{"platform":"android"}', '2026-11-23T01:00:00.000Z');

SELECT CASE WHEN
  (SELECT COUNT(*) FROM devices WHERE id = 'device-smoke' AND status = 'active') = 1
  AND (SELECT COUNT(*) FROM device_pairing_invites WHERE id = 'pairing-smoke' AND consumed_at IS NOT NULL) = 1
  AND (SELECT COUNT(*) FROM device_events WHERE device_id = 'device-smoke') = 1
THEN 'PASS' ELSE 'FAIL' END AS device_registry_check;
