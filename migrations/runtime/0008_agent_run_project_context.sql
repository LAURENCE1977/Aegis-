ALTER TABLE agent_runs ADD COLUMN project_id TEXT
  CHECK (project_id IS NULL OR length(project_id) BETWEEN 1 AND 128);

ALTER TABLE agent_runs ADD COLUMN context_digest TEXT
  CHECK (context_digest IS NULL OR (length(context_digest) = 71 AND substr(context_digest, 1, 7) = 'sha256:'));

ALTER TABLE agent_runs ADD COLUMN context_json TEXT
  CHECK (context_json IS NULL OR (json_valid(context_json) AND length(context_json) <= 12288));

CREATE INDEX IF NOT EXISTS idx_agent_runs_project_created
  ON agent_runs (project_id, created_at DESC, id DESC)
  WHERE project_id IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS agent_run_project_context_immutable
BEFORE UPDATE OF project_id, context_digest, context_json ON agent_runs
WHEN OLD.project_id IS NOT NEW.project_id OR OLD.context_digest IS NOT NEW.context_digest OR OLD.context_json IS NOT NEW.context_json
BEGIN
  SELECT RAISE(ABORT, 'agent run project context is immutable');
END;

CREATE TRIGGER IF NOT EXISTS agent_run_project_context_consistent
BEFORE INSERT ON agent_runs
WHEN
  (NEW.context_json IS NULL AND (NEW.project_id IS NOT NULL OR NEW.context_digest IS NOT NULL))
  OR
  (NEW.context_json IS NOT NULL AND (
    NEW.project_id IS NULL OR NEW.context_digest IS NULL
    OR json_extract(NEW.context_json, '$.digest') IS NOT NEW.context_digest
    OR json_extract(NEW.context_json, '$.brief.workspace.id') IS NOT NEW.project_id
  ))
BEGIN
  SELECT RAISE(ABORT, 'agent run project context binding is invalid');
END;
