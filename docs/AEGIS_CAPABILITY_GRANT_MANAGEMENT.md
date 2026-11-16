# AEGIS owner capability grant management

## Routes

The owner-authenticated Pages Function at `/api/grants` provides:

- `GET`: bounded grant history for the fixed single-owner principal.
- `POST`: create one exact-resource grant by selecting an approved capability, one or more registered action IDs and an expiry.
- `DELETE`: revoke one active grant by ID.

## Permission derivation

The browser cannot submit a principal ID, actor identity or arbitrary scopes. The API fixes the principal and creator to `owner`, loads the capability from the trusted registry, requires status `approved`, validates every requested action ID, and derives grant scopes from those actions' `requiredScopes`.

The repository rejects wildcard resources/scopes, caps grant lifetime at 90 days, and rejects duplicate active grants for the same principal/capability/version/resource. Revocation is principal-scoped and preserves the old row for history.

## Request protections

- Signed owner session required before D1 access.
- Writes require same-origin Origin validation.
- JSON bodies are streamed and size-bounded.
- Exact allowed fields only; caller-supplied `principalId`, `createdBy` or `scopes` are rejected.
- GET responses contain safe grant metadata only; no vault references or credential values.
- Missing D1 fails closed with 503.

## Current boundary

This is source code and test coverage only. No D1 binding has been provisioned or migrated, no production route has been deployed and no grant has been created in a live database. A grant is not an approval and never bypasses a human-always action gate.
