# First Source-Level Sandbox Findings

Reviewed: 2026-11-21. These are source-code observations from current default branches, not runtime penetration-test results. Exact commit SHAs must be pinned before any experiment.

## Tencent/LoopForge

Files inspected: SECURITY.md, internal/runtime/sandbox_docker.go, internal/httpapi/assistant_approval.go, internal/httpapi/assistant_sandbox.go.

Positive controls observed:
- Docker containers are created with all Linux capabilities dropped and no-new-privileges.
- Default/root images are run as the service UID/GID when the host process is non-root.
- The workspace bind is checked against the expected workspace path.
- Read-only root filesystem can be enabled, with a bounded tmpfs for /tmp.
- Teardown has a timeout and removes workspace/browser companion containers.
- The repository contains sandbox lifecycle, isolation, permission and approval tests.

Caveats:
- The inspected code only adds an explicit Docker network when a configured network or special relay path exists; it does not prove universal network denial by default.
- Read-only root filesystem is conditional on profile settings.
- The inspected create arguments did not establish CPU, memory, PID, disk or output ceilings. Verify profile and daemon enforcement.
- Conversation mode can mount conversation roots and a writable home path; that is not appropriate for arbitrary hostile repository code.
- Approval code supports confirm, assisted and auto modes. Auto can apply eligible drafts; assisted delegates review to another model. AEGIS must not treat either as Sentinel/human authorization.
- GitHub metadata returned licence NOASSERTION. Verify the actual licence file and component provenance before reuse.

Verdict: valuable container lifecycle, workspace binding and cleanup reference. Exclude auto/assisted approvals. Do not assume its Docker profile is sufficient for hostile code.

## ANOLISA

Inspected its Docker sandbox helper, lifecycle tests, tool-isolation tests and repository tree.

Positive controls:
- Dedicated Docker sandbox helper with health and execution readiness probes.
- Startup failure cleanup attempts stop and forced removal.
- Tests cover timeout/interrupt cleanup and container removal.
- Tests/modules exist for MCP tool isolation and audit-data isolation.
- Repository includes a dedicated Linux sandbox crate, sandbox manifest, security middleware and policy code.

Caveats:
- The inspected tool-isolation test requires a live OpenClaw gateway, Docker daemon and populated submodule; it was not executed in this audit.
- The command-execution endpoint is powerful. A container alone is not enough; inspect Linux namespaces, mounts, syscall and network enforcement.
- The monorepo contains deprecated and benchmark components; do not assume all paths are production security-core code.

Verdict: highest-priority sandbox reference in this batch. Next inspect the current Rust/Linux sandbox crate and manifest. Lifecycle tests are useful design evidence, not proof of escape resistance.

## PentAGI

Inspected backend/docs/docker.md and backend/pkg/docker/client.go.

Observed:
- Dedicated worker containers and per-flow volumes.
- Docker socket can be bind-mounted into worker containers when nested Docker access is configured.
- Host network mode is supported.
- PID limit defaults to 2048, with override support.
- no-new-privileges is explicitly not applied in the inspected path because the project wants SUID/SGID and sudo/su privilege-escalation testing inside its penetration-testing workers.

Verdict: defensive threat-model comparison only. Docker socket and host-network options are unacceptable for AEGIS's default experiment boundary. Do not reuse its worker execution configuration.

## CopilotKit/OpenBot

Inspected README and LangGraph AG-UI tool runtime.

Positive controls and design:
- Modular self-hosted workspace with AG-UI and pluggable computer execution.
- README describes backend identity, tool permission, action policy and audit enforcement.
- Computer execution can use Kubernetes or a compatible external provider.
- Server-owned tools are distinguished from computer/UI tools; server-owned tools use a signed callback path.
- README explicitly warns shared-computer evaluation lets one Bot read another person's files, and recommends per-person sandbox mode with a Kubernetes agent-sandbox controller.

Caveats:
- MIT application template is distinct from separately licensed CopilotKit Intelligence.
- Shared-computer mode is not an acceptable multi-user isolation boundary.
- Kubernetes setup has substantial operational/resource requirements for a lightweight Cloudflare control plane.

Verdict: strong reference for computer-execution provider separation and server-side tool authorization. If used, require sandbox mode rather than shared computers.

## TUIOS

Inspected SECURITY.md, README.md and docs/AGENT_STATE.md.

Positive design:
- Per-pane agent state, cross-session Inbox, worktree-based agent fleets, session-aware MCP and verified human replies.
- Docs describe pane-level grants and strict permissions mode.
- Agent-to-agent messages are fenced as data; human replies are marked verified.

Caveats:
- Primarily a terminal/workspace and permission coordination layer, not a hostile-code sandbox.
- Strict mode and grants are configuration choices; inspect defaults and all enforcement paths in source.
- Security policy supports only the latest default-branch commit and gives no guaranteed response time.

Verdict: strong Agent Operations and session/worktree reference, not an execution isolation solution.

## Hermes Workspace

Inspected src/lib/approvals-store.ts. It explicitly states execution approvals are not used; add/load/save/respond functions are no-op stubs.

Verdict: do not rely on this approval store as an enforcement mechanism. Workspace/terminal UX can be studied separately.

## Revised priority

1. ANOLISA Linux sandbox: inspect actual kernel boundary and tests.
2. OpenBot computer isolation: inspect Kubernetes sandbox provider and backend authorization.
3. LoopForge Docker runner: inspect network defaults, resource limits, mounts and cleanup; exclude automatic/model-assisted approvals.
4. TUIOS: inspect server-side grant checks and human reply provenance.
5. PentAGI: threat model only; no Docker socket, host network or privilege-escalation setup.
6. Hermes Workspace: UI patterns only; exclude its no-op approval store.
