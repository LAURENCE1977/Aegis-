-- Representative pre-0014 single-owner data. Run only against the isolated local test database.
INSERT INTO auth_sessions (session_id, created_at, expires_at, revoked_at)
VALUES ('legacy-owner-session', '2026-11-01T00:00:00.000Z', 1798761600, NULL);

INSERT INTO project_spaces
  (id, owner_id, name, description, status, created_at, updated_at)
VALUES
  ('legacy-space', 'owner', 'Legacy owner space', 'Pre-tenant migration fixture', 'active',
   '2026-11-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z');

INSERT INTO project_space_events
  (id, space_id, owner_id, event_type, summary, content, created_at)
VALUES
  ('legacy-space-event', 'legacy-space', 'owner', 'note', 'Legacy event',
   'Pre-tenant migration fixture event', '2026-11-01T00:00:00.000Z');

INSERT INTO aegis_memories
  (id, owner_id, project_id, kind, content, source_type, source_url,
   source_attribution, source_observed_at, confidence, sensitivity, status,
   tags_json, created_at, updated_at, expires_at)
VALUES
  ('legacy-memory', 'owner', NULL, 'fact', 'Legacy owner memory',
   'user-stated', 'https://example.invalid/legacy-fixture',
   'Migration test fixture', '2026-11-01T00:00:00.000Z', 1.0, 'internal',
   'accepted', '[]', '2026-11-01T00:00:00.000Z',
   '2026-11-01T00:00:00.000Z', NULL);
