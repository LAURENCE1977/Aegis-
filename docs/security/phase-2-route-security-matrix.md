# Phase 2.1 — API security test matrix

Branch: `feature/production-migrations`

This inventory records the existing Pages API and runtime authentication boundaries. It intentionally does not add blanket middleware or alter route contracts.

| Surface | Route family | Authentication boundary | Existing tests | Phase 2 status |
|---|---|---|---|---|
| Login | `/api/login` GET/POST/DELETE | Public entry/status; POST and DELETE require same-origin; login issues D1-persisted session | `auth.test.mjs` | Extended for persistence and revocation |
| Chat | `/api/ask` POST | Owner HMAC session; same-origin write | `auth.test.mjs` | Existing unauthenticated/cross-origin checks retained |
| Memory | `/api/memory` GET/POST/DELETE | Owner session; same-origin writes | `auth.test.mjs` | Existing checks retained |
| MCP | `/mcp` POST | `AEGIS_MCP_TOKEN` bearer; owner-session fallback; Origin optional for server-to-server callers and validated when present | `bridge.test.mjs` | Dedicated bearer path unchanged |
| Runtime | `/health`, `/v1/jobs`, `/v1/agent-runs` | Independent `AEGIS_JOB_TOKEN` bearer | `runtime-http.test.mjs`, `runtime-integration.test.mjs` | Runtime auth implementation unchanged |
| Status | `/api/status` GET | Currently public; exposes database and operational-state diagnostics | Phase 1 Pages smoke test | Known perimeter finding; diagnostic split remains follow-up |
| Capabilities | `/api/capabilities`, `/api/approvals`, `/api/grants` | Route-specific owner/capability policy | `capabilities-api.test.mjs`, `capability-approval-api.test.mjs`, `grants-api.test.mjs` | Existing tests retained |
| Sentinel | `/api/sentinel/*` | Route-specific owner auth and capability/grant mediation | `sentinel-*.test.mjs` | Existing tests retained |
| Forge | `/api/forge/*` | Route-specific owner auth and candidate/review policy | `forge-*.test.mjs` | Existing tests retained |
| Memories | `/api/memories/*` | Route-specific owner auth and memory lifecycle policy | `memory-*.test.mjs` | Existing tests retained |
| Workspaces | `/api/workspaces/*` | Route-specific owner auth and workspace policy | `workspace-api.test.mjs`, `project-spaces.test.mjs` | Existing tests retained |
| Registries | `/api/modules`, `/api/skills` | Route-specific read policy | `modules-api.test.mjs`, `skills.test.mjs` | Existing tests retained |
| AG-UI | `/api/ag-ui` | Route-specific request/session policy | `ag-ui-api.test.mjs`, `ag-ui-protocol.test.mjs` | Existing tests retained |

## Required assertions
- HMAC-SHA256 signature and existing HttpOnly, Secure, SameSite=Strict, host-only cookie attributes remain.
- Newly issued Pages sessions carry a session ID and require a matching, unexpired, unrevoked D1 record. Pre-deployment stateless HMAC cookies remain valid only until their original 12-hour expiry; they cannot be renewed by the new login path.
- D1 lookup errors fail closed; login cannot issue a session if D1 is unavailable.
- Logout revokes the server-side row and clears the cookie.
- MCP and runtime bearer credentials remain independent of Pages sessions.
- No global middleware is introduced.

This is the baseline route inventory and existing test map, not a claim that every listed route already has a new unauthenticated/cross-origin test. Full route-by-route assertion expansion and protection of detailed status diagnostics remain follow-up items.
