ALTER TABLE agent_runs ADD COLUMN project_id TEXT
  CHECK (project_id IS NULL OR length(project_id) BETWEEN 1 AND 128);

ALTER TABLE agent_runs ADD COLUMN context_json TEXT
  CHECK (context_json IS NULL OR (json_valid(context_json) AND length(context_json) <= 12288));

CREATE INDEX IF NOT EXISTS idx_agent_runs_project_created
  ON agent_runs (project_id, created_at DESC, id DESC)
  WHERE project_id IS NOT NULL;
