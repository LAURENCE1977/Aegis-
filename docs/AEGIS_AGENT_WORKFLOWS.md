# AEGIS Agent Workflow Definitions

## Purpose

`createAgentWorkflowDefinition` defines a bounded, declarative workflow contract for future AEGIS agent orchestration. It borrows useful operational ideas from agent runtimes and terminal command centres—ordered steps, explicit dependencies, evidence requirements and review gates—without importing their execution engines or approval models.

## Contract

The `aegis.agent-workflow-definition.v1` schema accepts at most 20 ordered steps. Each step has a stable identifier, one of the supported kinds (`discover`, `inspect`, `analyse`, `propose`, `verify`), explicit dependencies on earlier steps, allowlisted capabilities and mandatory evidence.

Capabilities are intentionally narrow: `source_read`, `workspace_read`, `workspace_write`, `artifact_read`, `artifact_write`, `test_run`. Workspace/artifact writes and test execution require `approval: human_required`. Automatic, assisted, model-delegated and self-approval modes are not accepted.

## Authority and limitations

This module validates and freezes a definition only. It does not schedule work, spawn agents, execute code, run tests, invoke MCP, access networks or secrets, grant capabilities, mutate a workspace, or deploy software. A definition is not an authorization token. The output always records `execution: not_authorised` and requires Sentinel approval for consequential actions.

Future orchestration must independently enforce each capability at the tool boundary, bind approvals to the exact action and evidence digest, isolate workspaces, record checkpoints, and treat all repository, agent and tool output as untrusted data. A workflow's requested capabilities must never override Sentinel policy.

## Durable workflow checkpoints

`createAgentWorkflowCheckpoint` builds an immutable `aegis.agent-workflow-checkpoint.v1` observation bound to the run identifier and pinned workflow-definition digest. Supported events describe observed step progress, evidence references, blockers, and run pause/resume observations. Evidence is represented only by bounded identifiers and SHA-256 digests; raw evidence bytes are never stored in the checkpoint.

`appendAgentWorkflowCheckpoint` persists checkpoints under a server-authenticated principal. The D1 table is owner/run scoped, uses a unique monotonic sequence and checkpoint identity, and rejects updates/deletes. Sequence allocation is an atomic `INSERT ... SELECT` guarded by the current maximum sequence, so concurrent writers cannot both claim the same next sequence. Exact retries are idempotent; gaps and conflicting identities are reported without rewriting history.

`listAgentWorkflowCheckpoints` reads one principal's ordered history and verifies each stored digest and row metadata before returning it. A caller must derive the principal from verified server-side identity; this store does not authenticate HTTP requests or create a runtime route.

## Authority boundary

A checkpoint is a record of an observation, not proof that the observation is truthful, not an execution receipt, not a capability grant, and not an approval. Checkpoints never change a workflow run's plan-only status. Sentinel remains the independent authority for any consequential action. No workflow scheduler, agent spawning, network/MCP access, secrets, workspace mutation, test execution, remediation or deployment is introduced by this layer.

## Sentinel-bound agent operation requests

`createAgentOperationRequest` creates an immutable `aegis.agent-operation-request.v1` envelope for the future Agent Operations Inbox. It revalidates the workflow run and evidence checkpoint, requires a checkpoint that contains at least one digest-only evidence reference, and requires the proposed action to match a capability declared on a workflow step marked `human_required`.

The request binds the canonical action digest, evidence digest, workflow-definition digest and checkpoint digest. Supported action types in this first contract are deliberately limited to `workspace_write`, `artifact_write` and `test_run`. Action parameters are represented by a SHA-256 digest; raw command text and arbitrary executable payloads are not accepted.

A request is only `awaiting_human_review`. It always records `approvalGranted: false`, `execution: not_authorised`, no capabilities granted and no self-approval. This contract does not persist an inbox, authenticate an HTTP caller, create a route, approve an action, schedule work, execute tools, spawn agents, invoke MCP, access networks or secrets, or mutate a workspace. A future review decision must bind the exact request, action and evidence digests and still pass independent Sentinel authorization at the execution boundary.

## Durable Agent Operations Inbox

`appendAgentOperationRequest` revalidates the immutable operation request against its workflow definition and evidence checkpoint before persisting it under a server-authenticated principal. The runtime D1 table is owner-scoped, stores the exact request envelope and its definition, checkpoint, action and evidence digests, and rejects updates/deletes. Exact retries are idempotent; reusing a request identity with different content is rejected.

`listAgentOperationRequests` returns one principal's requests newest-first with a stable compound cursor. Each stored JSON envelope is parsed, its canonical request digest is recomputed, and indexed row metadata is checked before the item is returned. The store does not authenticate HTTP requests: route handlers must derive the principal from verified server identity, never from caller-controlled request data.

Inbox persistence is not an approval mechanism. Every entry remains `awaiting_human_review`, with `approvalGranted: false` and `execution: not_authorised`. Human review must be a separate append-only decision bound to the exact request, action and evidence digests; Sentinel must independently enforce any eventual authorization at the execution boundary. No scheduler, agent spawning, capability grant, network/MCP access, secrets, workspace mutation or deployment is introduced here.

## Digest-bound human review ledger

`appendAgentOperationReview` accepts a human review observation only when the authenticated principal owns a verified, immutable inbox request and all three supplied digests match the persisted request, proposed action and evidence. It rechecks the request's canonical digest and row metadata before recording the event. The review ledger is append-only and event IDs are scoped to the authenticated principal.

The supported outcomes are `accepted_for_sentinel_evaluation`, `rejected`, `needs_more_evidence` and `withdrawn`. Approval-like values such as `approved` and `execute` are rejected. Every returned event explicitly records `approvalGranted: false`, `execution: not_authorised` and `sentinelApprovalRequired: true`. Acceptance for Sentinel evaluation is not authorization to execute. Sentinel must independently assess and authorize the exact action at the eventual execution boundary.

The ledger does not create an execution endpoint, capability grant, agent spawn, scheduler, network/MCP access, secret access, workspace mutation or deployment. HTTP route identity must be derived from verified server-side authentication.

## Authenticated Agent Operations HTTP routes

The runtime exposes `/v1/agent-operations` for owner-scoped inbox reads and request submissions, plus `/v1/agent-operations/reviews` for review history and append-only human decisions. Both routes require the runtime bearer token and the trusted single-owner principal assertion. Pages API routes additionally require the owner session, and writes require same-origin requests; the runtime token is never returned to the browser.

A submitted operation must reference an existing checkpoint from the authenticated principal's persisted, digest-verified workflow history. The runtime rebuilds the request envelope and stores it only after checking the pinned workflow, checkpoint, action and evidence bindings. Review submissions carry a stable event ID and the exact request/action/evidence digests; the review ledger rechecks all bindings before appending. Retrying an identical review event remains idempotent even when the server acceptance timestamp differs.

These routes only create and display review records. They do not execute proposed actions, create capability grants, spawn agents, call MCP, access secrets, mutate workspaces or deploy. A human review outcome such as `accepted_for_sentinel_evaluation` is not a Sentinel approval. Any eventual side effect must be translated to a registered capability and pass the existing Sentinel grant, policy, exact approval-consumption, audit and fixed-adapter path.
