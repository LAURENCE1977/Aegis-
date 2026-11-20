# AEGIS Integration Control Plane

## Status

Architecture and implementation contract. This document defines the next integration layer for the existing AEGIS capability system. It does not claim that a general outbound connector manager, Composio runtime, OAuth client manager or external tool execution is currently implemented.

The current repository already contains capability manifests, connection metadata, an encrypted secret-vault library, exact-resource grants, approvals, invocation audit, a Sentinel policy boundary and a fixed adapter registry. These are important foundations, but the repository's capability documentation explicitly states that the stores are not yet a general live connector service and that arbitrary HTTP, MCP, browser, shell, write and delete adapters remain disabled.

The integration control plane must compose those existing primitives. It must not create a parallel permission system.

## Goals

1. Make integrations discoverable and portable across providers, API gateways, MCP servers and connected-app platforms.
2. Represent one provider, one account/tenant, one credential reference and one capability as distinct concepts.
3. Register capabilities without granting them permission to execute.
4. Support multiple authentication modes without storing credentials in manifests or browser state.
5. Route every invocation through the existing Sentinel boundary.
6. Make connection health, scopes, cost/limits, provenance and verification status inspectable.
7. Allow new integrations to be added as data and fixed adapters, without hardcoding vendor assumptions into core orchestration.
8. Keep a useful read-only inventory even when a provider is disconnected or temporarily unavailable.

## Non-goals

- No universal arbitrary-URL HTTP proxy.
- No arbitrary MCP server installation or execution.
- No automatic OAuth consent, account linking, paid subscription, API-key creation or credential rotation.
- No implicit permission from discovery, connection presence, model output or agent plan.
- No provider key in frontend code, prompt context, logs, repository files or screenshots.
- No assumption that one shared API key provides every endpoint or action offered by the provider.
- No production resource provisioning or deployment as part of this architecture document.

## Existing connection-schema gap discovered during implementation review

The current `migrations/capabilities/0003_connections.sql` schema is narrower than the target integration model:

- `capability_connections.secret_ref` is `NOT NULL`, so public/no-auth and platform-managed connections without an AEGIS-owned vault secret cannot be represented honestly.
- The active uniqueness key is `(principal_id, provider_id)`, allowing only one active connection per principal/provider. That cannot represent multiple accounts or multiple integration/toolkit connections under one platform.
- The table has no distinct `integration_id`, stable per-account `connection_key`, connection-type enum, auth-mode enum, platform account identity, allowed-tool-slug list, or timestamped health state.
- The current status enum only records `active` and `revoked`; it cannot represent discovery, authentication, restriction, degradation or health independently.
- `capability_secrets` and the existing vault resolver bind ciphertext to `principal_id` and `provider_id`. Any schema expansion must preserve that binding and must not silently change the meaning of existing provider IDs.

Therefore Phase 1 requires a deliberate, backwards-compatible connection-schema migration before importing the user's Composio inventory. Do not insert fake secret references for public, shared or instant connections. The migration design should:

1. Preserve all legacy rows and map them explicitly to a legacy connection key and owner-private/API-key auth classification only where existing evidence supports that classification.
2. Introduce a stable integration identity and per-connection key so multiple toolkit/account records can coexist without weakening exact-resource grants.
3. Allow a nullable vault reference only for auth modes that do not require an AEGIS-owned secret; enforce the auth-mode/secret-reference relationship in validation and tests.
4. Store platform-managed account identity and exact allowed tool slugs as metadata, never as credentials or proof of execution entitlement beyond the platform's current allowlist.
5. Separate connection lifecycle status from timestamped health observations; a metadata listing must never imply `healthy`.
6. Keep Sentinel, grant, approval, vault and audit enforcement as the only invocation path. A schema migration must not itself enable any adapter.

Before implementation, inspect every query/resolver that reads or writes `capability_connections`, the vault's authenticated additional-data binding, and all migration tests. Test legacy-row preservation, duplicate account handling, no-secret auth modes, revocation, secret lookup isolation and append-only audit integrity against an isolated local D1 database.

## Core data model

Keep these entities separate and link them by stable IDs:

| Entity | Purpose | Sensitive? |
|---|---|---|
| Provider | Vendor or platform identity, e.g. Composio, OpenRouter, TinyFish | No |
| Integration | A product/API surface exposed by a provider | No |
| Connection | A specific account, tenant, workspace or shared connection | Metadata only; no secret values |
| Credential reference | Opaque pointer to a versioned vault entry and auth method | Yes; never expose vault material |
| Capability | A versioned, narrowly defined action with input/output schema | No |
| Grant | Owner-authorised principal + capability/version + exact resource + scopes | Security-critical |
| Approval | One-time approval for an exact operation and canonical input digest | Security-critical |
| Adapter | Server-owned implementation bound to exact capability/action IDs | Code trust boundary |
| Invocation | Pre/post audit, outcome, bounded usage and correlation IDs | Audit data |
| Health observation | Timestamped authentication/reachability/quota/capability probe | No credential values |

A provider can expose many integrations. An integration can have many connections. A connection may have several credential references, but every reference is scoped to one auth purpose and version. A capability can be available through multiple adapters, but each adapter is pinned to a reviewed implementation and destination policy.

## Authentication classes

Use an explicit enum, never a free-form credential blob:

- `api_key`: server-side key, stored only in the encrypted vault.
- `oauth2_authorization_code_pkce`: per-user delegated access with state, PKCE S256, exact redirect URI, audience/resource binding, least scopes and revocation.
- `oauth2_client_credentials`: server-to-server identity with narrow service scopes and rotation policy.
- `shared_platform_account`: a platform-managed shared/instant account; record the platform's ownership and allowed tool slugs, not a fictitious user-owned credential.
- `session_delegation`: a provider-managed session; short lifetime and explicit renewal semantics.
- `none_public`: public read-only capability with no credential.

Never collapse shared platform access and an owner-connected account into the same connection type. Store only the provider's opaque account identifier and the allowed capability/tool slugs when the platform supplies them. Do not infer that a discovered schema is executable if the connection's allowlist does not include it.

## Capability manifest contract

Each capability declaration must include:

- stable `capabilityId`, `version`, `providerId`, `integrationId`;
- human-readable name and purpose;
- exact input and output JSON schemas, with strict additional-property rejection;
- effect classification: `read`, `write_reversible`, `write_external`, `financial`, `destructive`;
- risk classification and approval policy;
- required connection type, auth mode and minimum scopes;
- exact resource binding rules; no wildcard resource IDs;
- fixed adapter ID and fixed destination/host policy where network access is needed;
- timeout, request/response byte limits, pagination ceiling and rate limit;
- cost/usage metadata with unknown values represented as unknown, never zero;
- data classification, retention notes and external data-processing destination;
- source URL, schema/version evidence, last verification time and licence/terms notes;
- health-check definition and whether the health probe is safe/read-only.

A manifest is descriptive policy input. It is not a grant, approval, secret, executable adapter or permission.

## Invocation lifecycle

All external tool calls must use this sequence:

1. Authenticate the owner/agent principal from trusted server context.
2. Resolve the exact registered capability, version and fixed adapter.
3. Validate input against the strict schema; reject unknown fields.
4. Resolve the active connection and confirm its type and status.
5. Check the required auth mode and provider-declared allowed tool slug.
6. Match an active exact-resource grant and required scopes.
7. Apply atomic per-principal/action rate limits and bounded cost/budget checks.
8. Derive the canonical input digest server-side.
9. Require and atomically consume one-time human approval for sensitive or consequential effects.
10. Write the redacted pre-execution audit event.
11. Resolve the minimum required credential from the encrypted vault into the adapter's short-lived server-only context.
12. Invoke the fixed adapter with bounded timeout, egress and response size.
13. Redact output and secrets; persist a bounded post-execution outcome.
14. Return only the schema-validated, size-bounded result.

Any failed policy, connection, vault, rate-limit, approval or audit step must fail closed. An adapter must not receive vault references, arbitrary URLs, arbitrary headers, caller-selected hosts or ambient credentials.

## Discovery and registration workflow

Discovery is a read-only intake process:

1. Enumerate integrations and connections from an authorised platform inventory.
2. Record the provider's exact name, connection identity/type, allowed tool slugs, auth status and source timestamp.
3. Discover schemas only for capabilities the platform says are available.
4. Normalise provider schemas into AEGIS's capability contract.
5. Mark each candidate `discovered`, not `approved`.
6. Review destination, scopes, effects, cost, terms, data handling and failure behavior.
7. Bind a fixed adapter implementation and add contract tests.
8. Owner reviews and activates an exact grant independently of registration.
9. Run a safe read-only verification probe, then record evidence and health.

Discovery must never automatically create grants, consume credentials, invoke write actions or enable new adapters.

## Connection health states

Use explicit, timestamped states:

- `discovered`: provider/tool found; not connected or tested.
- `connected_unverified`: connection metadata exists; no successful safe probe yet.
- `healthy`: last permitted probe succeeded within the health freshness window.
- `degraded`: service reachable but one or more expected capabilities/limits fail.
- `auth_required`: missing, expired, revoked or invalid credentials.
- `restricted`: provider account exists but requested tool/action is not in its allowed list.
- `rate_limited`: provider reports throttling or quota exhaustion.
- `disabled`: owner or policy has disabled use.
- `unknown`: no reliable current observation.

A successful metadata listing does not prove API execution. A connection record marked active does not prove the provider accepts requests. Never show `healthy` without a successful, timestamped probe.

## Cost, quotas and fallback

- Preserve unknown prices/quotas as `null` or `unknown`; never treat missing price as free.
- Separate platform subscription access, API metering, per-call charges, trial allowances and user-owned billing.
- Record source URL, verification timestamp, currency, billing unit and whether overage is possible.
- Before a potentially chargeable action, enforce a configured budget or ask the owner.
- Fallback only to a capability with equivalent approved purpose, data-handling constraints and permission. Do not silently send data to a different provider.
- Prefer low-cost routes only after checking quality requirements, limits, freshness and privacy constraints.

## Composio and other integration platforms

Treat Composio as an integration-discovery and execution platform, not as the AEGIS permission authority.

For every Composio toolkit/account, record separately:

- toolkit slug and display name;
- account identity alias (never credential values);
- account type: owner-private, workspace-shared, instant/platform-managed, public/no-auth or unknown;
- connection status and last observed timestamp;
- exact allowed tool slugs from the platform's current allowlist;
- discovered tool schemas and schema version/hash where available;
- auth errors and safe-probe results;
- platform price/usage disclosures and any user confirmation required.

The platform's tool discovery output, account inventory and execution allowlist can differ. A tool schema being discoverable does not establish that the current account may execute it. An inventory endpoint that lists private connections does not prove that shared or instant accounts are absent. Record the scope of each inventory query and label incomplete inventories honestly.

The same pattern applies to other API aggregators, MCP registries, OAuth brokers and model gateways.

## Initial AEGIS integration domains

These are categories, not claims of current connectivity:

- Model gateways and inference: OpenRouter, OpenAI-compatible APIs and individual model providers.
- Research and web retrieval: TinyFish, Firecrawl, Exa and other search/fetch services.
- Engineering: GitHub, repository inspection, code review and isolated build/test services.
- Infrastructure: Cloudflare, hosting, DNS, storage and cloud accounts.
- Observability/security: logs, metrics, error reporting, incident response and vulnerability intelligence.
- Knowledge/productivity: Notion, Google Workspace, email and calendars.
- Business systems: NetSuite and other ERP/CRM services.
- Browser/computer automation: only isolated, policy-controlled workers with human takeover and audit.

The user will provide an additional Composio inventory. Treat it as a reconciliation source, not as proof of successful authentication. Preserve unknown items until checked; do not silently discard integrations because they are not in an earlier shortlist.

## Minimum test suite before an adapter is enabled

- Strict schema validation rejects unknown fields and oversized payloads.
- No browser/client input can choose a URL, host, endpoint, header or credential.
- Unknown, revoked, expired and wrong-resource grants are rejected.
- Missing, expired and wrong-type connections fail closed.
- Disallowed platform tool slugs cannot execute even if their schemas are discoverable.
- Approval is bound to exact action, resource and canonical input digest; replay fails.
- Rate limits are atomic under concurrent requests.
- Pre-execution audit failure prevents adapter execution.
- Vault failure prevents adapter execution and no secret appears in output/logs.
- Redirects, private/internal IPs, DNS rebinding and unexpected egress are blocked.
- Timeout, cancellation, provider errors, malformed JSON/SSE and output caps are tested.
- Post-execution audit failure is represented as audit-incomplete, never false success.
- Cost unknown is not zero; over-budget actions are blocked or require approval.
- Health status expires and cannot remain healthy indefinitely without a fresh probe.

## Delivery sequence

### Phase 0 — Inventory and reconciliation
Collect the full provider/toolkit/account list, including shared and instant accounts. Keep screenshots and manually supplied lists as evidence with a capture date; never capture or store secret values.

### Phase 1 — Canonical registry
Add provider, integration, connection and capability schemas with strict validation and versioning. Map existing connection metadata and capability manifests rather than creating duplicate tables without a migration plan.

### Phase 2 — Read-only connector discovery
Add platform-specific inventory adapters that return only safe metadata and allowed tool slugs. Add pagination, freshness, partial-result and error reporting.

### Phase 3 — Safe adapter contract
Add a single adapter interface and a test harness. Start with one public/read-only capability and one owner-connected read-only capability. Keep all write and computer-use adapters disabled.

### Phase 4 — Sentinel composition
Wire connection lookup, vault resolution, grants, exact approvals, atomic limits and audit through the existing Sentinel composition root. No alternate invocation route.

### Phase 5 — Owner control centre
Display inventory, health, scopes, cost, provenance, last verification and approval state. Provide owner controls to disable/revoke connections without exposing secrets.

### Phase 6 — Carefully gated writes
Only after the read-only path passes independent security review, add one reversible write capability with exact-resource approval, idempotency and rollback. Financial, destructive and externally consequential actions remain separately gated.

## Acceptance criteria

The integration layer is ready for initial controlled use only when:

- inventory completeness and query scope are visible;
- every connection has an explicit owner/shared/instant classification;
- discovered tools are distinct from allowed tools and granted tools;
- no credential material leaves the vault boundary;
- every invocation is Sentinel-mediated and auditable;
- every adapter has strict schemas, bounded egress and regression tests;
- health and cost claims are timestamped and evidence-backed;
- read-only probes work without enabling write capabilities;
- owner revocation blocks future invocations;
- the system degrades safely when any provider or platform is unavailable.


## Phase 1 implementation checkpoint — metadata-only inventory substrate

Draft PR #124 adds the first storage/repository slice:

- `integration_providers` stores provider identity, source URL, verification timestamp and review state.
- `integration_definitions` stores a distinct integration/toolkit identity, provider link, auth mode, source URL, schema version/hash and review state.
- `integration_connections` stores owner-scoped account/tenant records with stable per-integration connection keys, connection/auth classification, safe account alias and opaque platform account ID, optional link to an AEGIS platform credential connection, exact allowed tool slugs, scopes, connection status and separate health observations.
- Multiple account connections can exist for the same integration; an upsert refresh resets health to `unknown` until a fresh observation is recorded.
- Public/no-auth records require `none_public` and no platform credential connection. Owner-private API/OAuth connections and workspace client-credential connections require an exact platform credential link; the repository verifies that the linked `capability_connections` row is active and matches both the same principal and integration provider.
- Inventory import cannot assert `healthy`; health requires a separate timestamped observation. The D1 smoke fixture links two toolkit accounts to one Composio platform credential, while constraint checks reject duplicate account keys, wildcard allowlists, auth-mode mismatches, unprobed healthy states and invalid credential links.
- The repository exposes metadata only. It does not resolve vault secrets, create grants/approvals, register executable adapters or invoke external tools.

Migration `0006_integration_inventory.sql` is source only and passed isolated local D1 migration and schema validation. GitHub Actions run [44732452090](https://github.com/LAURENCE1977/Aegis-/actions/runs/44732452090) passed **446 Node.js tests, 0 failures**, plus the D1 integration-inventory constraint checks and the existing capability/Forge verification steps. It has not been applied to any Cloudflare database. No Composio records have been imported; the user's screenshots and later authorised inventory retrieval remain the source for actual account names, aliases, statuses and tool slugs.

