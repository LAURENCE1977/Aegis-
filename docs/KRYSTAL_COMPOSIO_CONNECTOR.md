# Krystal → Composio connector

## Status

Source implementation is on the feature branch `feature/krystal-composio-mcp-connector-2026-11-23`. It is not production deployed or registered as a Composio toolkit yet.

## Architecture

Composio connects to the AEGIS remote MCP endpoint:

`POST https://<AEGIS-Pages-host>/mcp/krystal`

Composio's custom toolkit API-key auth scheme injects the user's Krystal API token as an `Authorization: Bearer <token>` header. The connector forwards that bearer credential only to the fixed Krystal Katapult API origin (`https://api.katapult.io/core/v1`). It does not persist the token, put it in a URL, or write it to logs.

## Exposed tools

Only three read-only tools are exposed:

- `krystal_list_organizations` — `GET /organizations` (requires `organizations:read`)
- `krystal_list_dns_zones` — `GET /organizations/organization/dns_zones` (requires `dns:read`)
- `krystal_list_dns_records` — `GET /dns_zones/dns_zone/records` (requires `dns:read`)

There are no create, update, delete, deployment, billing, server provisioning or arbitrary-URL tools. Requests are pinned to the official API origin, use GET only, validate identifiers and pagination, and return sanitised upstream errors.

## Composio custom toolkit registration

After the AEGIS endpoint has been deployed to a public HTTPS URL, create a Composio custom toolkit using the current v3.1 Custom MCP API:

- `name`: `Krystal (AEGIS read-only)`
- `mcp_url`: the final HTTPS URL ending in `/mcp/krystal` (no redirects)
- `auth_schemes`: `[{"mode":"API_KEY","headers":{"Authorization":"Bearer {{generic_api_key}}"}}]`
- `user_id`: `all` (shared toolkit; the API-key connection remains per user)

The custom toolkit create call requires the Composio project API key in the `x-api-key` header. Do not put that project key in this repository or in chat. Composio's custom-toolkit API returns the toolkit slug. The first connected API-key account triggers tool sync.

## Krystal credential setup

Create a Krystal API token with only the read scopes required for the tools:

- `organizations:read`
- `dns:read`

Add that token through Composio's custom toolkit connection flow, not in ChatGPT chat, GitHub, source code or a URL. Never grant write scopes for this initial connector.

## Verification and limitations

- Unit tests mock `fetch`; they do not contact Krystal or require a real token.
- Live verification requires a user-provided Krystal API token with the read scopes above, entered through Composio.
- AEGIS preview/production deployment and Composio toolkit registration are separate steps.
- The existing AEGIS MCP Bridge and its authentication remain unchanged.
