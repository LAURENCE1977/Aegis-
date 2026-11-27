# Phase 2.6 — Pages API route security matrix

Branch: `feature/production-migrations`

This matrix records the current route boundary after Steps 2.6.7–2.6.13. The request membrane is selective: it is not a replacement for route-local authentication on handlers that have not been migrated. Every sensitive handler must enforce its own authenticated principal/role boundary or be dispatched through the membrane, and the two intentionally public probes are restricted to minimal data.

## Central middleware and membrane

`functions/_middleware.js` classifies canonical API paths and dispatches these paths through `functions/lib/membrane/pipeline.mjs` and `functions/lib/membrane/route-policy.mjs`:

- `/api/login`
- `/api/memories` and `/api/ask`
- `/api/admin/principals` and `/api/admin/tenants`
- `/api/sessions`
- `/api/health` and `/api/status`
- `/api/account/password` and `/api/account/recovery`
- `/api/tenants/invitations` and `/api/tenants/recovery`

These policies use closed schemas, method allowlists and bounded bodies/queries. The middleware rejects ambiguous API path encodings before dispatch. The handler remains responsible for authenticating the principal, enforcing role/tenant authority and checking same-origin on state-changing browser requests.

## Route-family inventory

| Surface | Routes | Authentication and authority boundary |
|---|---|---|
| Login/session bootstrap | `/api/login` | POST is same-origin and password-authenticated; DELETE is same-origin and revokes the current session. GET reports only whether the current request is authenticated. The optional `tenantId` is a selection hint and is accepted only when it matches an active membership returned by the server-side credential lookup; it does not create or override a membership. |
| Generic health | `/api/health` | Intentionally public; returns only `ok` and service identity. It does not return database state, threat level, tenant or principal data. |
| Internal status | `/api/status` | Session-authenticated and membrane-registered. Detailed operational state is not exposed to anonymous callers. |
| Chat and AG-UI | `/api/ask`, `/api/ag-ui` | Session/owner authentication; same-origin protection on writes; conversation continuity is session-bound. |
| Memory | `/api/memory`, `/api/memories/*` | Session/owner authentication; owner/principal/tenant scope is derived from the verified session and repository boundary. |
| Tenant/principal administration | `/api/admin/principals`, `/api/admin/tenants` | Verified session plus tenant-scoped owner/admin checks; platform tenant lifecycle is root-owner-only. `principalId` and `tenantId` in administrative operations identify the target resource only after actor authority and tenant scope are checked; they never replace the caller identity. |
| Invitations and recovery | `/api/tenants/invitations`, `/api/tenants/recovery`, `/api/account/recovery` | Invitation and recovery issuance require an authorised tenant owner/admin session. Invitation acceptance also requires an authenticated principal with exact normalized identity match. Recovery completion is a time-limited, single-use bearer-token operation; the token is the credential for that one operation, not a client-supplied principal override. |
| Credential rotation | `/api/account/password` | Verified session, current-password verification, strong new password, same-origin and revocation of other sessions. Root bootstrap password remains encrypted-deployment-secret managed. |
| Session administration | `/api/sessions` | Verified session. Non-admin callers can see/revoke only their own sessions; owner/admin callers are still scoped to the active tenant. A query `principalId` is a target selector, not caller identity. |
| Approvals, capabilities and grants | `/api/approvals`, `/api/capabilities`, `/api/grants` | Route-local owner authentication; grant/capability policy derives authority from the authenticated principal and server-side registry. |
| Sentinel | `/api/sentinel/*` | Route-local authenticated principal plus exact capability/grant mediation and same-origin checks for writes. |
| Forge | `/api/forge/*` | Route-local authenticated session and owner/candidate review policy; external repository content remains untrusted reference data. |
| Project Spaces | `/api/workspaces/*` | Route-local authenticated principal; workspace, event and memory queries are tenant/principal scoped server-side. |
| Registries | `/api/modules`, `/api/skills` | Authenticated read-only registry access. |
| MCP Bridge | `/mcp` | Separate bearer/session boundary; read-only initial tool surface. |
| Runtime Worker | `/health`, `/v1/jobs/*`, `/v1/agent-runs/*` | Separate runtime bearer-token boundary; it is not a Pages API route and does not inherit Pages sessions. |

## Identity-field interpretation

- `ownerId` is not accepted as authority from the browser. Ownership is derived from the authenticated principal and trusted repository arguments.
- `principalId` and `tenantId` may appear only as target/selection identifiers in the explicitly scoped operations above. Each is checked against the authenticated actor's role and tenant boundary before use. The server-side caller principal and active tenant always come from the verified session.
- The membrane's generic forbidden-key list is prototype-pollution focused; identity authority is enforced by each route's closed schema and server-side scope checks, not by assuming those three names are globally forbidden in every JSON payload.
- Routes not centrally dispatched through the membrane retain explicit route-local authentication helpers. Do not describe the membrane as a blanket API firewall or claim that every route uses the same middleware path.

## Required assertions
- HMAC-SHA256 signature and existing HttpOnly, Secure, SameSite=Strict, host-only cookie attributes remain.
- Newly issued Pages sessions carry a session ID and require a matching, unexpired, unrevoked D1 record. Pre-deployment stateless HMAC cookies remain valid only until their original 12-hour expiry; they cannot be renewed by the new login path.
- D1 lookup errors fail closed; login cannot issue a session if D1 is unavailable.
- Logout revokes the server-side row and clears the cookie.
- MCP and runtime bearer credentials remain independent of Pages sessions.
- No blanket request-body middleware is applied to the existing API surface. The root Pages middleware performs canonical path classification, rejects ambiguous separators and normalisation, and sends only POST /api/login through the membrane. Other existing API routes retain their route-specific controls until individually audited and migrated.

This is the baseline route inventory and existing test map, not a claim that every listed route already has a new unauthenticated/cross-origin test. Full route-by-route assertion expansion and protection of detailed status diagnostics remain follow-up items.


## Phase 2 security extension roadmap

| Step | Protection | Planned control | Status |
|---|---|---|---|
| 2.1 | API security test matrix | Inventory route families, authentication boundaries and regression coverage | Completed |
| 2.2 | Revocable server-side sessions | HMAC-signed session IDs backed by D1 expiry and revocation records | Completed |
| 2.3 | Login-attempt throttling | D1-backed rolling window; five attempts per client IP, sixth attempt locks for 15 minutes; HMAC-keyed IP identity; generic failure response | Implemented; 441 tests passed and all 10 production migrations applied successfully to isolated local D1 in GitHub Actions |
| 2.4 | Fail-closed PII and secret scrubbing | Shared bounded scrubber redacts bearer/API-key/private-key patterns, email and phone PII, plus configured owner PII values; rejects unsupported/cyclic/oversized object graphs. Applied to structured memory ingestion. Log and all audit/D1 sinks still require a route-by-route inventory before sign-off | In progress |
| 2.5 | OWASP ASI06 memory-poisoning write guards | Memory ingestion accepts only user/external provenance classes, assigns untrusted server-side, and stores new records as candidate; owner review is required before normal retrieval. Trusted system state and capability policy are not writable through this memory route | In progress |
| 2.6 | Canary tripwires | Non-credential decoy markers and controlled probe surfaces; detect access without exposing real secrets; alert and invoke a bounded, owner-approved containment policy | Planned |

### Step 2.3 policy notes

- Rate-limit identity is derived from Cloudflare's `CF-Connecting-IP` header and keyed with HMAC-SHA256 using a domain-separated input and the existing session secret.
- Raw client IP addresses are not stored in D1.
- Missing trusted client identity or D1 failure blocks login rather than bypassing protection.
- The sixth attempt inside a 15-minute window is blocked for 15 minutes.
- Incorrect-password and throttled responses are identical (`401`, same body).
- Successful login clears the corresponding attempt bucket.
- This is per-client-IP protection; edge/WAF controls and broader distributed credential-stuffing detection remain complementary follow-ups.


### Aegis-DSL / SEM implementation record (2026-11-25)

The architecture direction is codified in docs/architecture/aegis-dsl-sem.md. It is a staged target architecture, not a declaration that all listed paradigms already exist.

- Step 2.4 shared implementation: functions/lib/data-guards.mjs.
- Supported secret patterns: bearer credentials, common OpenAI/GitHub token shapes, AWS access-key IDs and PEM private-key blocks.
- Supported PII patterns: email addresses and phone-like strings, plus configured exact values supplied through AEGIS_PII_VALUES.
- The scrubber has depth/node limits, rejects unsupported object types and cycles, and returns a redaction count. It is applied before the structured /api/memories write reaches the repository.
- It is not yet a global logging middleware and does not yet cover every D1/audit sink. Those remain required inventory and integration work before Step 2.4 can be signed off.
- Step 2.5: incoming structured memories are limited to user/external provenance classes; system-observation and project-event cannot be asserted by this public write boundary. The server stamps provenance as untrusted, and new records remain candidate until owner review.
- Memory content remains reference data, never instructions. The chat prompt already explicitly preserves that boundary.
- No direct browser-to-D1 access, zero-knowledge claim, 30-second ESCT, behavioral biometric telemetry, automatic Golden State rollback, generated migration AST, or 3D avatar has been implemented by this change.


## Step 2.6.7 — selective Pages membrane integration

- The first integration is scoped to the existing `POST /api/login` handler, whose current contract accepts JSON with a single `password` property. The membrane rejects duplicate JSON keys, extra properties, unsupported media types, malformed UTF-8, over-limit bodies and ambiguous API path encodings before the handler runs.
- The membrane modules are namespaced under `functions/lib/membrane/` because `functions/lib/data-guards.mjs` is already used by existing memory-ingestion security controls and must not be overwritten.
- Static assets, `GET /api/login`, and other existing API handlers continue through the existing Pages routing and security controls.
- This is an application-layer Pages middleware boundary, not a hypervisor, kernel, firmware or silicon-level security boundary.
- **Verification passed on 25 November 2026:** the full Node suite reports 464 tests (459 passed, 0 failed, 5 conditionally skipped); the dedicated Wrangler Pages Dev integration suite reports 5/5 passed. The Pages Functions bundle builds successfully, the local production-schema D1 migration applies, and both repository validation workflows succeed. See [AEGIS tests run](https://github.com/LAURENCE1977/Aegis-/actions/runs/45718286973) and [D1/Pages validation run](https://github.com/LAURENCE1977/Aegis-/actions/runs/45718286998).

- The Pages runtime verifies encoded `%2F` and `%5C` separators. A literal backslash may be canonicalised by the Fetch/URL layer before Pages middleware receives `request.url`; rejection of the original raw request-target character requires an edge/WAF rule before URL normalisation.
