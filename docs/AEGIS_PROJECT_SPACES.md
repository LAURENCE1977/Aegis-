# AEGIS Project Spaces and Agent Teams

## Purpose

Combine the strongest workspace and multi-agent ideas inspected in LangAlpha and OpenCompany into one AEGIS-owned system. This is a clean-room implementation of product and architecture concepts; no upstream code or agent definitions are copied.

Sources:
- LangAlpha (Apache-2.0): https://github.com/ginlix-ai/LangAlpha
- OpenCompany (MIT): https://github.com/zeenie-ai/OpenCompany

Both projects are references, not runtime dependencies. LangAlpha's market-research focus and OpenCompany's desktop-first AI-employee stack are not AEGIS's product boundary.

## AEGIS ownership model

AEGIS remains the sole authority for:
- project/workspace identity and ownership;
- persistent project context and append-only activity history;
- agent definitions, team membership and delegation records;
- canonical job IDs, execution state and retries;
- memory scope and retention;
- capability manifests, connections, permissions and approvals;
- audit and user-visible activity.

An external agent framework or model provider may be used behind an adapter only. It must not create a competing source of truth or bypass AEGIS policy.

## Project Spaces v0.1

The first implementation slice provides:
- owner-scoped project spaces with a name and short description;
- a D1-backed activity timeline;
- typed events: `note`, `decision`, `research`, `task`, `agent_handoff`, `agent_result`, and `feedback`;
- append-only event records, owner-filtered reads and bounded list sizes;
- authenticated, no-store APIs for listing/creating spaces, reading a space, and reading/appending events;
- same-origin protection for writes and strict content/type/size validation.

The activity timeline is the durable shared project history, not a prompt transcript. Event content is untrusted data and must never be treated as instructions or permissions merely because it is stored in a workspace.

Current implementation boundaries:
- API and D1 migration are on the `feature/aegis-project-spaces` branch.
- The shared D1 binding is named `AEGIS_DB`; approval records and workspace records are intended to share one database.
- No Cloudflare D1 database or binding has been provisioned or deployed.
- There is no browser workspace UI, file/blob attachment system, full-text search, multi-user sharing, or agent execution integration yet.
- No destructive workspace deletion or archive API is exposed.
- Tests are authored but must be run in CI before the feature is considered verified.

## Agent Teams — next implementation

Use the OpenCompany lead/specialist and LangAlpha parallel-research patterns, but define AEGIS-native role and delegation contracts.

A team definition should include:
- stable team and agent IDs, versions and provenance;
- one lead role and a bounded set of specialist roles;
- role purpose, input/output schemas and completion criteria;
- explicit project-space and memory scopes;
- capability IDs allowed for discovery (never permissions);
- concurrency, token/cost/time budgets and retry limits;
- delegation parent/child IDs and durable handoff records;
- reviewer role and acceptance checks;
- human approval gates for external, destructive, financial, permission or production actions.

A delegated task is a child of one canonical AEGIS job. It records requested work, assigned role, workspace, status, outputs, evidence and review outcome. A lead may delegate and review, but it cannot grant capabilities or bypass the central policy evaluator. Tool discovery should use compact capability names and fetch full schemas on demand; every invocation still passes through AEGIS policy.

## Execution model

1. User creates or selects a Project Space.
2. AEGIS stores the task request and context reference.
3. The orchestrator chooses a team definition and provider based on capability, policy and budget.
4. The lead creates bounded child tasks and records handoffs in the workspace timeline.
5. Specialists work with scoped context and capabilities through the durable AEGIS runtime.
6. Results include source evidence and are written back as typed workspace events.
7. The lead reviews results against completion criteria and returns a consolidated deliverable.
8. Any consequential action pauses for an exact-operation owner approval.
9. The runtime persists final state and audit; the workspace keeps the project history.

## Security and cost constraints

- Project reads and writes are owner-scoped server-side; client-supplied owner IDs are never trusted.
- Event types are allowlisted, content is bounded, and writes require same-origin requests.
- Workspace text, files, research pages and agent outputs are untrusted data.
- No repository or browser content can alter agent policy or tool permissions.
- No arbitrary shell or code execution is part of the Project Spaces API.
- Agent concurrency, recursion, wall time, tokens, model spend, storage and event volume need explicit ceilings.
- Background execution belongs to the server-side durable runtime, not a mobile browser tab.
- A project-space event is not itself an approval or an audit substitute for a real external side effect.

## Licensing and provenance

LangAlpha's repository identifies Apache-2.0; OpenCompany's repository identifies MIT. AEGIS records these as source licences only. This implementation uses independently authored AEGIS contracts and code. If future work copies any upstream code or substantial text, it must separately preserve the relevant notices and licence obligations. No packages, desktop apps, containers, connectors or upstream agent definitions have been installed.


## Project Space handover briefs

The owner-only `GET /api/workspaces/:id/brief` endpoint creates a bounded, read-only handover brief from one active Project Space. It includes recent event summaries and accepted, non-restricted, unexpired project memories only; source URLs and raw event bodies are excluded. Content is marked untrusted reference data and never grants permissions. See [AEGIS Project Space briefs](AEGIS_PROJECT_BRIEFS.md).
