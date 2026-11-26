-- AEGIS legacy-owner migration fixture.
-- Intended database state: migrations 0001–0013 applied.
-- Purpose: prove migration 0014 correctly backfills legacy owner data.
--
-- This fixture must run BEFORE migration 0014.
-- Do not add tenant_id or principal_id here: those columns do not
-- exist in the original pre-0014 schema.

PRAGMA foreign_keys = ON;

-- Legacy owner session. Migration 0014 adds and backfills identity columns.
INSERT INTO auth_sessions (
  session_id,
  created_at,
  expires_at,
  revoked_at
) VALUES (
  'legacy-owner-session',
  '2026-01-01T00:00:00.000Z',
  1893456000,
  NULL
);

-- Legacy project space.
INSERT INTO project_spaces (
  id,
  owner_id,
  name,
  description,
  status,
  created_at,
  updated_at
) VALUES (
  'legacy-space',
  'owner',
  'Legacy Migration Fixture',
  'Pre-0014 owner-scoped project space fixture',
  'active',
  '2026-01-01T00:00:00.000Z',
  '2026-01-01T00:00:00.000Z'
);

-- Legacy project-space event.
INSERT INTO project_space_events (
  id,
  space_id,
  owner_id,
  event_type,
  summary,
  content,
  created_at
) VALUES (
  'legacy-space-event',
  'legacy-space',
  'owner',
  'note',
  'Legacy migration fixture event',
  'Pre-0014 owner-scoped event used to verify tenant identity backfill.',
  '2026-01-01T00:00:00.000Z'
);

-- Legacy memory.
-- Migration 0012 automatically creates its corresponding memory event.
INSERT INTO aegis_memories (
  id,
  owner_id,
  project_id,
  kind,
  content,
  source_type,
  source_url,
  source_attribution,
  source_observed_at,
  confidence,
  sensitivity,
  status,
  tags_json,
  created_at,
  updated_at,
  expires_at
) VALUES (
  'legacy-memory',
  'owner',
  'legacy-space',
  'fact',
  'Legacy memory used to verify tenant identity migration.',
  'user-stated',
  'https://fixture.invalid/legacy-memory',
  'Migration test fixture',
  '2026-01-01T00:00:00.000Z',
  1.0,
  'internal',
  'accepted',
  '[]',
  '2026-01-01T00:00:00.000Z',
  '2026-01-01T00:00:00.000Z',
  NULL
);

-- Fail if the fixture did not create exactly the expected records.
CREATE TEMP TABLE __legacy_fixture_assertions (
  passed INTEGER NOT NULL CHECK (passed = 1)
);

INSERT INTO __legacy_fixture_assertions (passed)
SELECT
  (SELECT COUNT(*) FROM auth_sessions
    WHERE session_id = 'legacy-owner-session') = 1
  AND
  (SELECT COUNT(*) FROM project_spaces
    WHERE id = 'legacy-space' AND owner_id = 'owner') = 1
  AND
  (SELECT COUNT(*) FROM project_space_events
    WHERE id = 'legacy-space-event'
      AND space_id = 'legacy-space'
      AND owner_id = 'owner') = 1
  AND
  (SELECT COUNT(*) FROM aegis_memories
    WHERE id = 'legacy-memory'
      AND owner_id = 'owner'
      AND project_id = 'legacy-space') = 1
  AND
  (SELECT COUNT(*) FROM aegis_memory_events
    WHERE memory_id = 'legacy-memory'
      AND owner_id = 'owner'
      AND event_type = 'created') = 1;

DROP TABLE __legacy_fixture_assertions;
