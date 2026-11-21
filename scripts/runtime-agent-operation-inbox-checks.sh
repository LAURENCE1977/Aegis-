#!/usr/bin/env bash
set -euo pipefail

CONFIG=wrangler.runtime-d1-test.toml
DB=aegis-runtime-test
PERSIST=.wrangler/test-runtime-d1
DIGEST=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
REQUEST_JSON='{"schemaVersion":"aegis.agent-operation-request.v1","requestId":"operation-smoke-001","runId":"run-smoke","workflowId":"workflow-smoke","definitionDigest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","checkpointId":"checkpoint-smoke","checkpointDigest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","actionDigest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","evidenceDigest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","requestDigest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","createdAt":"2026-11-21T14:00:00.000Z","status":"awaiting_human_review","authority":{"sentinelApprovalRequired":true,"approvalGranted":false,"execution":"not_authorised","capabilitiesGranted":false,"selfApproval":false}}'

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

insert_request() {
  local owner="$1"
  local request_id="$2"
  execute "INSERT INTO agent_operation_requests (principal_id, request_id, run_id, workflow_id, definition_digest, checkpoint_digest, action_digest, evidence_digest, request_digest, request_json, created_at) VALUES ('$owner', '$request_id', 'run-smoke', 'workflow-smoke', '$DIGEST', '$DIGEST', '$DIGEST', '$DIGEST', '$DIGEST', '$REQUEST_JSON', '2026-11-21T14:00:00.000Z')"
}

insert_request owner-a operation-smoke-001
# A different principal has a separate inbox namespace.
insert_request owner-b operation-smoke-001

expect_rejected "duplicate request identity for the same principal" "INSERT INTO agent_operation_requests (principal_id, request_id, run_id, workflow_id, definition_digest, checkpoint_digest, action_digest, evidence_digest, request_digest, request_json, created_at) VALUES ('owner-a', 'operation-smoke-001', 'run-smoke', 'workflow-smoke', '$DIGEST', '$DIGEST', '$DIGEST', '$DIGEST', '$DIGEST', '$REQUEST_JSON', '2026-11-21T14:01:00.000Z')"
expect_rejected "malformed action digest" "INSERT INTO agent_operation_requests (principal_id, request_id, run_id, workflow_id, definition_digest, checkpoint_digest, action_digest, evidence_digest, request_digest, request_json, created_at) VALUES ('owner-a', 'operation-bad', 'run-smoke', 'workflow-smoke', '$DIGEST', '$DIGEST', 'bad-digest', '$DIGEST', '$DIGEST', '$REQUEST_JSON', '2026-11-21T14:01:00.000Z')"
expect_rejected "request update" "UPDATE agent_operation_requests SET request_json = '{}' WHERE principal_id = 'owner-a' AND request_id = 'operation-smoke-001'"
expect_rejected "request deletion" "DELETE FROM agent_operation_requests WHERE principal_id = 'owner-a' AND request_id = 'operation-smoke-001'"
