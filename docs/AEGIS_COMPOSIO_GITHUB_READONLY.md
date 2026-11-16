# AEGIS Composio GitHub read-only adapter

## Scope

The current Composio GitHub session is deliberately pinned to two read-only tools:

- `GITHUB_GET_A_REPOSITORY` — repository metadata for one exact owner/repository.
- `GITHUB_GET_A_PULL_REQUEST` — metadata for one exact pull request.
- `GITHUB_LIST_WORKFLOW_RUNS_FOR_A_REPOSITORY` — at most ten workflow-run summaries for one exact repository and optional branch.

No issue comments, workflow/job log downloads, workflow execution, repository contents, code writes, branch writes, pull-request writes, shell, MCP, multi-execute, or arbitrary tool discovery is enabled in this session.

The Composio API client fixes the backend origin, session ID format, account ID format, tool slugs, request shapes, response byte ceiling, timeout and redirect policy. Provider error bodies and credentials are not returned to callers.

## Sentinel boundaries

Repository metadata uses:

- Capability: `aegis-composio-github-readonly`
- Action: `get-repository`
- Resource: `github:repository:{owner}/{repo}`
- Grant scope: `github:repository:read`

Pull request metadata uses:

- Capability: `aegis-composio-github-pull-request-readonly`
- Action: `get-pull-request`
- Resource: `github:pull-request:{owner}/{repo}/{pullNumber}`
- Grant scope: `github:pull-request:read`

Both actions require the authenticated owner, the exact active Composio connection, its encrypted Vault-backed session reference, an exact-resource grant, the session's exact approved tool allowlist, rate-limit reservation and a recorded Sentinel audit lifecycle. The agent cannot select a provider, tool slug, account, endpoint or arbitrary arguments.

The pull-request normalizer returns only bounded metadata: PR number, title, state, draft/merged flags, GitHub URL, base/head refs and SHAs, and change counts. It deliberately omits PR body text, comments, review text and other untrusted free-form content.

The workflow-run normalizer returns at most ten records, verifies each record's repository and optional branch, and constrains run URLs to the exact GitHub repository. It returns status/conclusion, commit SHA, branch, run number/attempt and timestamps; it deliberately omits commit messages, logs, artifacts and other untrusted free-form content. The Composio client fixes pagination to page 1 and ten records.

## Existing connection compatibility

Newly created Composio sessions enable exactly the three approved read-only tool slugs. Older sessions created with only repository metadata remain valid for repository reads; sessions with repository and pull-request tools remain valid for those two actions. Workflow reads require the new workflow tool in the session, so the owner must reconnect through AEGIS to provision a fresh three-tool session before that action can run. The adapter fails closed rather than dynamically adding tools to an existing session.

## Operational policy

- Read-only by construction; no write scopes are present.
- Reconnect/consent and exact resource grants are separate from manifest registration.
- Any additional GitHub operation must receive its own action contract, input validation, exact resource binding, output normalizer, tests and reviewed allowlist change.
- Never enable arbitrary Composio tool selection, MCP, multi-execute or shell execution.
- Workflow run/job inspection may be a future read-only action, but is not enabled by this implementation.
