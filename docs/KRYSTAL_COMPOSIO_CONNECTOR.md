# Krystal ↔ Composio integration assessment

## Verified account/API credential type

The Krystal Client Area page at `/client/app#/account/apikeys` labels the generated key under **Domain Reseller Module**. Krystal's official help article explains that this credential is for the Krystal WHMCS Domain Reseller module: the module uses the API username and API secret to provision, transfer and renew domain names. The same article says domain provisioning may charge the payment card or account credit balance, and cancelled domain registrations are not refundable.

This is not evidence that the key grants general Krystal hosting, Katapult cloud, DNS-zone or DNS-record API access. Do not send it to a Katapult API endpoint or configure it as a generic bearer token.

Official documentation:
- https://help.krystal.io/whmcs/setting-up-whmcs-domain-provisioning-using-the-krystal-domain-reseller-module
- https://docs.katapult.io/docs/api/core/katapult-core-api
- https://docs.katapult.io/docs/api/core/get-dns-zone-records
- https://docs.katapult.io/docs/api/core/post-organization-api-tokens
- https://github.com/krystal/katapult-php (a separate Katapult Core/Public API client; its token model is not proof that the Domain Reseller credential works with it)

## Security incident / credential handling

A newly generated API secret was visible in the authenticated Krystal browser page content during integration inspection. Treat that specific key as compromised and revoke/delete it in Krystal. Do not reuse it in Composio, AEGIS, WHMCS, scripts or another service. Generate a replacement only if Krystal confirms the intended API and after the integration has a verified authentication design. Never paste API secrets into ChatGPT or commit them to Git.

## Integration decision

No Krystal connector endpoint is implemented in this change. The previous draft endpoint assumed the Katapult Core API, bearer authentication and DNS endpoints without confirming that the visible Domain Reseller key supported those operations; that draft has been removed rather than risk sending the wrong credential to the wrong API.

## Newly verified Krystal Cloud Core API

Krystal's official developer documentation confirms a separate Katapult Core API (now branded Krystal Cloud):
- Base URL: https://api.katapult.io/core/v1
- Authentication: OAuth 2.0 authorization-code flow and bearer API tokens. The documented OAuth authorization/token endpoints are on https://identity.krystal.io.
- The DNS-record listing operation is GET /dns_zones/dns_zone/records. It accepts a DNS zone ID or name and documents the `dns:read` scope as read-only; `dns` is the broader DNS-management scope.
- For OAuth, scopes are prefixed with `api.katapult.io/core/v1/`. The Core API also documents organization API tokens with explicit scope lists; token secrets are returned only when created or regenerated.

This verifies that a least-privilege Core API route exists in the product documentation. It does **not** verify that this particular Client Area account has a Krystal Cloud organization, that the user is entitled to create Core API tokens, or that the visible Domain Reseller credential can access it. The reseller credential remains out of scope.

Important live topology finding: the user's existing domain is registered through Krystal but its active nameservers are Cloudflare, and its two live DNS records are hosted in the Cloudflare zone. Therefore, a Krystal DNS connector is not needed to read or manage DNS for this domain today. Use the already-working Cloudflare API-key connection for that zone. A Krystal Core API connector would be useful only for DNS zones actually hosted in Krystal Cloud or other Core API resources the account owns.

Before implementation, confirm only the remaining account-specific points with Krystal:
1. Whether this account has access to Krystal Cloud / Katapult Core API and can create an organization API token.
2. Whether a token can be restricted to exactly `dns:read` (or other individually approved read-only scopes required for the actual resources).
3. Whether the account's intended hosting/domain services are represented in this Core API, or whether a separate hosting/registrar API is required.

Do not create a token with `dns`, `api_tokens`, VM power, write, billing, registration, transfer or renewal scopes for this read-only integration. The support request should ask for **read-only access only** and explicitly exclude domain registration, transfer, renewal, hosting changes and paid provisioning.

## Composio integration route

Composio's documented Custom MCP feature can register a public HTTPS MCP server as a toolkit and sync its tools. It supports API-key authentication (for example, an Authorization: Bearer header) or DCR OAuth. A private per-user Custom MCP toolkit requires a Composio Pro plan; a shared toolkit is available on all plans but is visible to users in that Composio project, so do not use a shared toolkit unless the project membership and sharing boundary are understood.

AEGIS already has an initial MCP Bridge at `POST /mcp`, but it currently exposes only authenticated, read-only status, module and skill tools. It does not yet implement an outbound API connector manager or a Krystal adapter. A dedicated, narrowly scoped Krystal MCP endpoint or a tested AEGIS adapter must be implemented before registering it in Composio. The current AEGIS bridge's bearer-token authentication may fit Composio's API-key scheme, but this must be verified against the live endpoint and its configured secret before registration.

Required future safeguards:
- Per-user credentials entered only in Composio's secure connection flow or a verified encrypted secret store.
- Read-only allowlisted GET endpoints only; fixed official API host; no arbitrary URLs.
- No write, billing, registration, transfer, renewal or provisioning tools.
- Tests with mocked HTTP responses, then an owner-approved live read-only test.
- Feature branch, CI and preview verification; no production deployment until reviewed.
