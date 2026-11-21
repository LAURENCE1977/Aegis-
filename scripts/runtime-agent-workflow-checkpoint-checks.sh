#!/usr/bin/env bash
set -euo pipefail

CONFIG=wrangler.runtime-d1-test.toml
DB=aegis-runtime-test
PERSIST=.wrangler/test-runtime-d1
DIGEST=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
CHECKPOINT_JSON='{"schemaVersion":"aegis.agent-workflow-checkpoint.v1","checkpointId":"checkpoint-001","runId":"run-smoke","workflowId":"workflow-smoke","definitionDigest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","sequence":1,"observedAt":"2026-11-21T14:00:00.000Z","eventType":"step_progress_observed","stepId":"inspect","evidence":[],"authority":{"observationOnly":true,"executionOccurred":false,"execution":"not_authorised","capabilitiesGranted":false,"sentinelApprovalRequired":true,"selfApproval":false},"checkpointDigest":"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}'

execute() {
  wrangler d1 execute "$DB" --local --config "$CONFIG" --persist-to "$PERSIST" --command "$1"
}

expect_rejected() {
  local description="$1"
  local sql="$2"
  if execute "$sql"; then
    echo "Expected runtime D1 to reject: $description"
    exit 1
  fi
}

execute "INSERT INTO agent_workflow_checkpoints (principal_id, run_id, sequence, checkpoint_id, workflow_id, definition_digest, checkpoint_digest, checkpoint_json, observed_at) VALUES ('owner-a', 'run-smoke', 1, 'checkpoint-001', 'workflow-smoke', '$DIGEST', '$DIGEST', '$CHECKPOINT_JSON', '2026-11-21T14:00:00.000Z')"

# A different owner has a separate namespace even for the same run and checkpoint IDs.
execute "INSERT INTO agent_workflow_checkpoints (principal_id, run_id, sequence, checkpoint_id, workflow_id, definition_digest, checkpoint_digest, checkpoint_json, observed_at) VALUES ('owner-b', 'run-smoke', 1, 'checkpoint-001', 'workflow-smoke', '$DIGEST', '$DIGEST', '$CHECKPOINT_JSON', '2026-11-21T14:00:00.000Z')"

expect_rejected "duplicate sequence for the same owner and run" "INSERT INTO agent_workflow_checkpoints (principal_id, run_id, sequence, checkpoint_id, workflow_id, definition_digest, checkpoint_digest, checkpoint_json, observed_at) VALUES ('owner-a', 'run-smoke', 1, 'checkpoint-002', 'workflow-smoke', '$DIGEST', '$DIGEST', '$CHECKPOINT_JSON', '2026-11-21T14:01:00.000Z')"
expect_rejected "duplicate checkpoint identifier for the same owner and run" "INSERT INTO agent_workflow_checkpoints (principal_id, run_id, sequence, checkpoint_id, workflow_id, definition_digest, checkpoint_digest, checkpoint_json, observed_at) VALUES ('owner-a', 'run-smoke', 2, 'checkpoint-001', 'workflow-smoke', '$DIGEST', '$DIGEST', '$CHECKPOINT_JSON', '2026-11-21T14:01:00.000Z')"
expect_rejected "malformed checkpoint digest" "INSERT INTO agent_workflow_checkpoints (principal_id, run_id, sequence, checkpoint_id, workflow_id, definition_digest, checkpoint_digest, checkpoint_json, observed_at) VALUES ('owner-a', 'run-smoke', 2, 'checkpoint-bad', 'workflow-smoke', '$DIGEST', 'bad-digest', '$CHECKPOINT_JSON', '2026-11-21T14:01:00.000Z')"
expect_rejected "checkpoint update" "UPDATE agent_workflow_checkpoints SET checkpoint_json = '{}' WHERE principal_id = 'owner-a' AND run_id = 'run-smoke' AND sequence = 1"
expect_rejected "checkpoint deletion" "DELETE FROM agent_workflow_checkpoints WHERE principal_id = 'owner-a' AND run_id = 'run-smoke' AND sequence = 1"
