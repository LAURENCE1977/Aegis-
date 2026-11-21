#!/usr/bin/env bash
set -euo pipefail

CONFIG=wrangler.runtime-d1-test.toml
DB=aegis-runtime-test
PERSIST=.wrangler/test-runtime-d1
DIGEST=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
REQUEST_JSON='{"schemaVersion":"aegis.agent-operation-request.v1","requestId":"operation-review-smoke","runId":"run-smoke","workflowId":"workflow-smoke","definitionDigest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","checkpointId":"checkpoint-smoke","checkpointDigest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","actionDigest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","evidenceDigest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","requestDigest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","createdAt":"2026-11-21T14:00:00.000Z","status":"awaiting_human_review","authority":{"sentinelApprovalRequired":true,"approvalGranted":false,"execution":"not_authorised","capabilitiesGranted":false,"selfApproval":false}}'

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
  execute "INSERT INTO agent_operation_requests (principal_id, request_id, run_id, workflow_id, definition_digest, checkpoint_digest, action_digest, evidence_digest, request_digest, request_json, created_at) VALUES ('$owner', 'operation-review-smoke', 'run-smoke', 'workflow-smoke', '$DIGEST', '$DIGEST', '$DIGEST', '$DIGEST', '$DIGEST', '$REQUEST_JSON', '2026-11-21T14:00:00.000Z')"
}

insert_request owner-a
insert_request owner-b

execute "INSERT INTO agent_operation_review_events (event_id, principal_id, request_id, request_digest, action_digest, evidence_digest, decision, note, created_at) VALUES ('review-smoke-001', 'owner-a', 'operation-review-smoke', '$DIGEST', '$DIGEST', '$DIGEST', 'accepted_for_sentinel_evaluation', 'Human review recorded for independent Sentinel evaluation.', '2026-11-21T14:10:00.000Z')"
# Event identities are isolated by principal.
execute "INSERT INTO agent_operation_review_events (event_id, principal_id, request_id, request_digest, action_digest, evidence_digest, decision, note, created_at) VALUES ('review-smoke-001', 'owner-b', 'operation-review-smoke', '$DIGEST', '$DIGEST', '$DIGEST', 'needs_more_evidence', 'A separate principal review.', '2026-11-21T14:11:00.000Z')"

expect_rejected "approval-like review decision" "INSERT INTO agent_operation_review_events (event_id, principal_id, request_id, request_digest, action_digest, evidence_digest, decision, note, created_at) VALUES ('review-invalid-001', 'owner-a', 'operation-review-smoke', '$DIGEST', '$DIGEST', '$DIGEST', 'approved', 'Must not grant approval.', '2026-11-21T14:12:00.000Z')"
expect_rejected "orphan request reference" "INSERT INTO agent_operation_review_events (event_id, principal_id, request_id, request_digest, action_digest, evidence_digest, decision, note, created_at) VALUES ('review-orphan-001', 'owner-a', 'missing-request', '$DIGEST', '$DIGEST', '$DIGEST', 'rejected', 'Must reference an existing inbox request.', '2026-11-21T14:12:00.000Z')"
expect_rejected "review update" "UPDATE agent_operation_review_events SET decision = 'rejected' WHERE principal_id = 'owner-a' AND event_id = 'review-smoke-001'"
expect_rejected "review deletion" "DELETE FROM agent_operation_review_events WHERE principal_id = 'owner-a' AND event_id = 'review-smoke-001'"
