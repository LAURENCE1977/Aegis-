# Krystal ↔ Composio integration assessment

## Verified account/API credential type

The Krystal Client Area page at `/client/app#/account/apikeys` labels the generated key under **Domain Reseller Module**. Krystal's official help article explains that this credential is for the Krystal WHMCS Domain Reseller module: the module uses the API username and API secret to provision, transfer and renew domain names. The same article says domain provisioning may charge the payment card or account credit balance, and cancelled domain registrations are not refundable.

This is not evidence that the key grants general Krystal hosting, Katapult cloud, DNS-zone or DNS-record API access. Do not send it to a Katapult API endpoint or configure it as a generic bearer token.

Official documentation:
- https://help.krystal.io/whmcs/setting-up-whmcs-domain-provisioning-using-the-krystal-domain-reseller-module
- https://github.com/krystal/katapult-php (a separate Katapult Core/Public API client; its token model is not proof that the Domain Reseller credential works with it)

## Security incident / credential handling

A newly generated API secret was visible in the authenticated Krystal browser page content during integration inspection. Treat that specific key as compromised and revoke/delete it in Krystal. Do not reuse it in Composio, AEGIS, WHMCS, scripts or another service. Generate a replacement only if Krystal confirms the intended API and after the integration has a verified authentication design. Never paste API secrets into ChatGPT or commit them to Git.

## Integration decision

No Krystal connector endpoint is implemented in this change. The previous draft endpoint assumed the Katapult Core API, bearer authentication and DNS endpoints without confirming that the visible Domain Reseller key supported those operations; that draft has been removed rather than risk sending the wrong credential to the wrong API.

Before implementation, ask Krystal support to confirm:
1. Which API product the account is entitled to use for the user's actual goal (hosting management, DNS management, or domain reseller provisioning).
2. The official API base URL, version, authentication method, endpoint documentation/OpenAPI specification and rate limits.
3. Whether a separate API token is available with read-only DNS/hosting scopes.
4. Whether API calls can incur domain-registration, transfer, renewal, hosting or other charges; how to disable write/provisioning operations.

Support request should explicitly say: **read-only DNS zone and record discovery for an existing domain; no domain registration, transfer, renewal, hosting changes or paid actions.**

## Composio integration route

Composio's Custom MCP toolkit API is a potential route once the correct API and authentication scheme are confirmed. AEGIS already has an initial MCP Bridge at `POST /mcp`, but it does not yet implement an outbound API connector manager. A separate, narrowly scoped MCP endpoint can be added after the official Krystal API details are confirmed.

Required future safeguards:
- Per-user credentials entered only in Composio's secure connection flow or a verified encrypted secret store.
- Read-only allowlisted GET endpoints only; fixed official API host; no arbitrary URLs.
- No write, billing, registration, transfer, renewal or provisioning tools.
- Tests with mocked HTTP responses, then an owner-approved live read-only test.
- Feature branch, CI and preview verification; no production deployment until reviewed.
