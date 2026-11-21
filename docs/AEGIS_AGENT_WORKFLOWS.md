# AEGIS Agent Workflow Definitions

## Purpose

`createAgentWorkflowDefinition` defines a bounded, declarative workflow contract for future AEGIS agent orchestration. It borrows useful operational ideas from agent runtimes and terminal command centres—ordered steps, explicit dependencies, evidence requirements and review gates—without importing their execution engines or approval models.

## Contract

The `aegis.agent-workflow-definition.v1` schema accepts at most 20 ordered steps. Each step has a stable identifier, one of the supported kinds (`discover`, `inspect`, `analyse`, `propose`, `verify`), explicit dependencies on earlier steps, allowlisted capabilities and mandatory evidence.

Capabilities are intentionally narrow: `source_read`, `workspace_read`, `workspace_write`, `artifact_read`, `artifact_write`, `test_run`. Workspace/artifact writes and test execution require `approval: human_required`. Automatic, assisted, model-delegated and self-approval modes are not accepted.

## Authority and limitations

This module validates and freezes a definition only. It does not schedule work, spawn agents, execute code, run tests, invoke MCP, access networks or secrets, grant capabilities, mutate a workspace, or deploy software. A definition is not an authorization token. The output always records `execution: not_authorised` and requires Sentinel approval for consequential actions.

Future orchestration must independently enforce each capability at the tool boundary, bind approvals to the exact action and evidence digest, isolate workspaces, record checkpoints, and treat all repository, agent and tool output as untrusted data. A workflow's requested capabilities must never override Sentinel policy.
