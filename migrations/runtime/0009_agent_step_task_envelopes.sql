ALTER TABLE agent_run_steps ADD COLUMN task_json TEXT
  CHECK (
    task_json IS NULL OR (
      json_valid(task_json)
      AND length(task_json) <= 4096
      AND json_type(task_json) = 'object'
      AND json_extract(task_json, '$.schemaVersion') = '1.0'
      AND json_extract(task_json, '$.executionMode') = 'plan-only'
      AND json_type(task_json, '$.capabilityRequests') = 'array'
      AND json_array_length(task_json, '$.capabilityRequests') = 0
    )
  );

CREATE TRIGGER IF NOT EXISTS agent_run_step_task_envelope_immutable
BEFORE UPDATE OF task_json ON agent_run_steps
WHEN OLD.task_json IS NOT NEW.task_json AND OLD.task_json IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'agent task envelopes are immutable');
END;
