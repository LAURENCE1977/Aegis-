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
