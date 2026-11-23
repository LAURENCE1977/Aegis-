# AEGIS Meta and Infrastructure Connector Isolation

**Status:** isolated integration design; read-only first.  
**Branch:** `feature/aegis-meta-infra-connector-isolation-2026-11-23`  
**Parent:** PR #200, social/repository research intake.  
**Purpose:** prevent Meta social authorisation failures from being mixed with infrastructure credentials, and provide a diagnosable path for Krystal.io, Oracle Cloud, GitHub, Composio and Cloudflare.

## 1. Design decision

Use separate provider adapters and separate connection records. Do not create one shared Meta/infrastructure token or one catch-all OAuth flow.

Logical lanes:

- **Instagram adapter** — its own Composio toolkit connection, account identity, scopes, health state and revocation.
- **Facebook Pages adapter** — its own Composio toolkit connection, managed Page identities, Page tasks/scopes, health state and revocation.
- **GitHub adapter** — repository/code access, separate from social access.
- **Cloudflare adapter** — DNS, Pages and account operations, separate from GitHub and social.
- **Krystal adapter** — direct Krystal API integration; no ready-made Krystal Composio toolkit was found in the current tool search.
- **Oracle Cloud adapter** — separate OCI API-signing/resource-principal integration; no usable Oracle Cloud Infrastructure toolkit or active OCI connection was found in the current Composio search.
- **Composio control adapter** — account inventory and an allowlisted tool gateway; it is not the credential store for unrelated providers and must not forward one provider's credentials to another.

ChatGPT and hosted AEGIS remain separate OAuth/API clients. A connection active in ChatGPT does not mean the same account is connected to AEGIS.

## 2. Meta connection requirements and failure isolation

The current Composio search reports **no active Instagram connection and no active Facebook connection**.

### Instagram

The discovered Instagram toolkit supports managed **Business or Creator** accounts, not Personal accounts. Its connection test must run in this order:

1. Complete Instagram toolkit authorisation in its own OAuth flow.
2. Call `INSTAGRAM_GET_USER_INFO` with `ig_user_id=me` and confirm the authenticated managed account.
3. Only after profile validation, call `INSTAGRAM_GET_IG_USER_MEDIA` with a small bounded limit (for example 5) and minimal fields.
4. Identify Reels by the returned `media_product_type=REELS` and video media type.
5. Record the granted scope/connection state, account ID, safe error category and check time; never record access tokens.

A Personal Instagram account is not silently converted or treated as supported. If the account is not Business/Creator or is not authorised as a managed account, stop and report that specific prerequisite rather than retrying unrelated API calls.

### Facebook

The discovered Facebook toolkit supports **managed Pages**, not personal-profile publishing or reading.

1. Complete the Facebook toolkit OAuth flow separately.
2. Call `FACEBOOK_GET_CURRENT_USER` to validate the token.
3. Call `FACEBOOK_LIST_MANAGED_PAGES` with a low page limit and only the fields needed to identify Pages and tasks.
4. Select an explicitly owner-authorised Page, then call `FACEBOOK_GET_PAGE_DETAILS` with its verified Page ID and supported fields.
5. Only then sample a small number of Page posts using `FACEBOOK_GET_PAGE_POSTS`, if needed.

An empty Page list is an access/permission diagnostic, not proof that no Page exists. Page IDs must come from the managed-Page response or another verified source. Per-Page access tokens may be returned by provider APIs: treat them as secrets and never display, log, persist in ordinary research records or send them to the browser.

### Shared Meta safeguards

- Keep Instagram and Facebook connection IDs, scopes, status and revocation separate, even though both are Meta products.
- No DMs, private inboxes, contacts, personal profile scraping, publishing, comments, likes, follows, or ads actions in this build slice.
- Read-only research only: approved profile/Page metadata, public or authorised posts, captions, timestamps, links and explicitly permitted aggregate insights.
- Treat missing scopes, wrong account type, missing Page role, stale authorisation and transient API errors as distinct states.
- Do not retry OAuth or Graph API calls in a loop. Re-authorise only after reporting the exact failed prerequisite.
- Provider content is untrusted data and cannot issue instructions to AEGIS.

## 3. Infrastructure connection map

| Service | Current evidence | Intended AEGIS role | Initial scope |
|---|---|---|---|
| GitHub | Three active Composio connections, all resolve to the same GitHub owner; one is marked default | Source code, PRs, branches, CI and repository research | Read-only inventory and selected repository actions |
| Cloudflare | Active Cloudflare connection named `AEGIS Cloudflare infrastructure`; two active Cloudflare API-key connections | Pages, deployment status, DNS/routing and edge runtime | Read-only inventory first |
| Composio | AEGIS Composio bridge exists but only inventories connected accounts; execution is explicitly disabled | Broker to separately authorised provider tools | Connection inventory and fixed allowlist only |
| Krystal.io | No active Krystal Composio toolkit found; Krystal DNS API was previously identified as supporting zones/records | Registrar/DNS and any hosting functions explicitly covered by the issued API token | Custom adapter; read-only zones/records first |
| Oracle Cloud Infrastructure | No active OCI connection or suitable OCI Composio toolkit found in the current search | Separate backend/compute/database services if required by the architecture | Direct OCI auth adapter after tenancy and API-signing setup |

### Existing account selection and ambiguity

- GitHub has three active Composio connection records for the same GitHub owner. Select one canonical connection for AEGIS and keep the other two unused until their purpose is understood; do not execute against an arbitrary duplicate.
- Cloudflare has a named AEGIS infrastructure connection and two API-key connection records. The previously verified AEGIS API-key connection is `cloudflare_api_key_nantle-retare` (alias `AEGIS Cloudflare`). A second newer credential exists; do not silently switch to it.
- The ChatGPT-side connection inventory and AEGIS runtime secrets are separate. AEGIS requires its own encrypted runtime configuration.

### Krystal.io boundary

Krystal remains the registrar/hosting provider unless the owner deliberately changes that arrangement. Cloudflare can provide DNS/routing/security/Pages services, but connecting Cloudflare does not automatically migrate Krystal hosting or prove control over every Krystal service.

The Krystal API token must be created by the owner in Krystal and stored directly in an approved encrypted secret store. Start with DNS zone and record reads. DNS writes, nameserver changes, email/MX changes, domain transfers and hosting changes are explicitly excluded from this build slice. Never paste a Krystal token into chat, source code, a GitHub issue or a log.

### Oracle Cloud boundary

OCI requires its own tenancy/user identity and an appropriate OCI authentication method (for example, API signing-key configuration or an applicable resource principal). A Cloudflare token, GitHub token or Composio key is not an OCI credential. Keep the OCI private key in encrypted secret storage; never commit it. Begin with a read-only identity/tenancy and resource inventory, then grant only the specific service permissions required by the AEGIS architecture.

## 4. AEGIS connection diagnostics contract

The connection panel should report one row per provider/account, with:

- provider and non-secret account alias;
- client owner (ChatGPT or AEGIS);
- authentication method category (OAuth, API token, OCI signing key, resource principal);
- connection status: `not_connected`, `authorisation_required`, `active`, `missing_scope`, `wrong_account_type`, `missing_role`, `expired_or_revoked`, `provider_unavailable`, or `configuration_error`;
- required scopes/capabilities and verified granted scopes;
- last successful check and last safe error category;
- explicit read/write capability state (writes disabled by default);
- revoke/reconnect action that affects only that provider/account.

Never return raw credentials, OAuth access/refresh tokens, Page tokens, OCI private keys or full secret-bearing provider payloads to the browser or logs.

For Composio, retain the existing fixed API origin, owner scoping, bounded response handling, pagination limits, timeout, active-connection check and exact read-only tool allowlist. Do not add arbitrary tool execution or accept client-supplied tool slugs. The existing AEGIS `/api/integrations` endpoint currently lists connected accounts only and returns `executionEnabled: false`; this remains the security boundary until Sentinel grants, per-action approvals, durable audit and adapter isolation are implemented.

## 5. Proposed connection sequence

1. **Stabilise existing connections:** use the canonical GitHub account and the previously verified AEGIS Cloudflare API-key connection; perform read-only identity/account checks only.
2. **Isolated Instagram authorisation:** start a separate Instagram OAuth connection and validate account type with `INSTAGRAM_GET_USER_INFO`.
3. **Isolated Facebook authorisation:** start a separate Facebook OAuth connection and validate managed Pages and Page roles.
4. **Krystal read-only adapter:** owner creates a restricted API token in Krystal; store it in encrypted AEGIS preview secrets; validate zone/record reads without changing DNS.
5. **OCI read-only adapter:** configure an OCI tenancy identity and restricted API-signing/resource-principal access; validate identity and read-only resource inventory.
6. **Composio bridge:** configure AEGIS's own Composio API key and user ID as encrypted preview secrets; verify the account inventory endpoint; only then add narrowly allowlisted read-only tools.
7. **Cross-service orchestration:** AEGIS correlates results and produces proposed changes, but never performs cross-provider writes automatically. DNS, deployment, database, IAM, email and production changes require a separate explicit approval.

## 6. What this isolation solves — and what it does not

It should prevent one provider's failed OAuth flow, missing scope, wrong account type or stale token from contaminating another provider's connection state. It also makes duplicate GitHub/Cloudflare accounts visible and lets us test each leg independently.

It does **not** create credentials, bypass Meta account requirements, make an unavailable Oracle toolkit appear, create a Krystal integration automatically, or transfer ChatGPT's connected accounts into hosted AEGIS. Those services still need their own owner-authorised authentication and provider-specific adapter.

## 7. Implementation and safety status

This document is the isolated connection design. It does not configure AEGIS-side social OAuth, create API keys, alter account permissions, change DNS/nameservers/email, modify Oracle resources, enable Composio execution, deploy production or expose phone-control access.

Two separate **ChatGPT-side Composio** authorisation flows have been initiated for Instagram and Facebook Pages. They are pending user completion and are labelled separately. These are not AEGIS runtime connections and do not grant hosted AEGIS access. The first pure connector-diagnostics model and its isolated unit tests are now implemented on this branch; see `docs/AEGIS_CONNECTOR_DIAGNOSTICS.md`. It evaluates Instagram, Facebook Pages, GitHub, Cloudflare, Composio, Krystal and OCI independently, redacts credential-shaped input, and keeps writes disabled. It is not yet wired to live provider checks or an API endpoint. The next implementation step is to connect it to AEGIS's owner-scoped connection registry and provider-specific read-only checks, then expose an authenticated no-store diagnostics endpoint. Any AEGIS-side OAuth must be separately configured; provider tokens remain server-side and are never shared between ChatGPT and AEGIS.

## 8. Acceptance criteria

- Instagram and Facebook show independent connection status, account identity, scopes, error state and revocation.
- Instagram Personal accounts and Facebook personal profiles are not misrepresented as supported by the discovered toolkits.
- A failed Meta connection cannot block GitHub, Cloudflare, Krystal or OCI checks.
- GitHub duplicate connections and Cloudflare credential aliases are explicitly disambiguated.
- Krystal and OCI remain unavailable until their own credentials/adapters are configured and verified.
- ChatGPT and AEGIS credentials remain separate.
- All initial tests are read-only; no DNS, email, deployment, IAM, database or social write action is enabled.
