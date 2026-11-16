# AEGIS owner capability grant management

## Routes

The owner-authenticated Pages Function at `/api/grants` provides:

- `GET`: bounded grant history for the fixed single-owner principal.
- `POST`: create one exact-resource grant by selecting an approved capability, one or more registered action IDs and an expiry.
- `DELETE`: revoke one active grant by ID.

## Permission derivation

The browser cannot submit a principal ID, actor identity or arbitrary scopes. The API fixes the principal and creator to `owner`, loads the capability from the trusted registry, requires status `approved`, validates every requested action ID, and derives the grant scopes from those actions' `requiredScopes`.

The repository rejects wildcard resources/scopes and caps grant lifetime at 90 days. Duplicate active grants for the same principal/capability/version/resource are rejected. Revocation is principal-scoped and preserves the old row for history.

## Request protections

- Signed owner session required before D1 access.
- Writes require same-origin Origin validation.
- JSON bodies are streamed and size-bounded.
- Exact allowed fields only; caller-supplied `principalId`, `createdBy` or `scopes` are rejected.
- GET responses contain safe grant metadata only; no vault references or credential values.
- Missing D1 fails closed with 503.

## Current boundary

This is source code and test coverage only. No D1 binding has been provisioned or migrated, no production route has been deployed and no grant has been created in a live database. Owner grant management is not a public permission service. Approval remains a separate, one-time operation for actions that require it.

## Verification

GitHub Actions run 43789320560 on commit 161e69899a045a83635110efe50b0f89870727f0 passed **353 tests, 0 failures** under Node.js 22. Coverage includes unauthenticated access, missing D1, owner-only listing, registry-derived grants, invalid capability/action/extra fields, hostile origins, malformed/oversized JSON and same-origin revocation.
