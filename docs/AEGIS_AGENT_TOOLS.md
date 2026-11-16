# AEGIS AG-UI Sentinel tool loop

## Activation

Agent tool calling is disabled by default. It is offered only when all of the following are true:

- `AEGIS_AGENT_TOOLS_ENABLED=true` is explicitly configured.
- `AEGIS_MODEL_PROVIDER=alibaba-qwen`.
- The Qwen API key, workspace ID and supported region are valid.
- A D1 binding is available.
- The selected model is the tested `qwen3.8-flash` model (or the model setting is omitted and the default is used).

The default Workers AI text-only model receives no tool definitions. Other Qwen models remain text-only until separately verified. No environment flag or provider secret is set by this source change.

## Server-owned tool registry

The AG-UI endpoint never accepts frontend-supplied function definitions. It continues to reject non-empty `tools` arrays from the browser. When enabled, the server supplies exactly four function schemas:

1. `aegis_list_modules` — local read-only AEGIS module catalogue.
2. `aegis_discover_public_github_repository` — bounded public GitHub repository metadata.
3. `aegis_read_github_workflow_runs` — at most ten GitHub Actions workflow-run summaries for one exact repository and optional branch, through the fixed Composio adapter.
4. `aegis_read_github_workflow_jobs` — at most twenty job summaries and bounded step summaries for one exact workflow run, through the fixed Composio adapter.

## Execution sequence

1. Qwen may request a tool from the server-supplied schema.
2. AG-UI accumulates streamed function-name and argument deltas.
3. A single tool call is allowed per run. Multiple, recursive, unknown or oversized calls fail closed.
4. The server validates the tool name and exact JSON argument shape. The model cannot provide a principal, resource ID, adapter, endpoint or permission.
5. The server derives the resource identity and calls `executeAgentToolCall`.
6. The tool runner invokes `runSentinelInvocation`, which checks the exact grant and active provider connection, reserves the atomic per-action rate-limit slot, writes audit events and dispatches the fixed adapter. Composio workflow reads receive only the server environment and fixed Composio adapter; the model cannot choose a tool slug, account, session, endpoint or connection.
7. The bounded tool result is added as a tool-role message and sent to Qwen once more without tool definitions. Recursive tool execution is not allowed.

The assistant then streams its final response through AG-UI 1.0.

## Safety boundaries

- Unknown tools and malformed arguments are rejected.
- The model cannot define or add tools.
- The browser cannot send tool schemas, resource IDs or principal IDs.
- The default Workers AI path is text-only.
- Only one tool round is allowed per run.
- GitHub discovery requires the exact `github:public:{owner}/{repository}` grant and the 30-per-minute D1 rate limit.
- Composio workflow-run reads require the separate `aegis-composio-github-workflow-readonly` capability, `github:workflow:read` scope and exact `github:repository:{owner}/{repo}` resource grant.
- Composio workflow-job reads require `aegis-composio-github-workflow-jobs-readonly`, `github:workflow-jobs:read` and exact `github:workflow-run:{owner}/{repo}/{runId}` resource grant. Both require the active Composio connection and the matching fixed tool in the session. Job output is bounded to job status/conclusion and step name/number/status/conclusion; logs, artifacts, reruns, dispatch and cancellation remain unavailable.
- No private GitHub access, source execution, shell, browser automation, MCP, writes or deletes are included.

## Verification and deployment

Tests cover the four-tool registry, Qwen opt-in/model allowlist, strict argument parsing, exact grant/rate-limit/audit execution, Composio workflow-run and workflow-job denial without exact grants, streamed tool-call deltas, one-call limit and no-tools follow-up. CI also applies migrations 0001–0006 to local D1 and checks the real SQL constraints.

The feature remains inactive until the owner explicitly configures the flag, supported Qwen credentials and D1 binding. No credentials or production settings were changed.
