-- Cover the exact tenant/principal/project/status keyset traversal order.
-- This migration is local/CI-only until an explicitly approved production rollout.
CREATE INDEX IF NOT EXISTS idx_aegis_memories_cursor_scope
  ON aegis_memories (
    tenant_id,
    principal_id,
    project_id,
    status,
    updated_at DESC,
    id ASC
  );
