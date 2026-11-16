# AEGIS capability connections — metadata foundation

## Status

This branch adds the owner-scoped connection metadata repository and D1 migration. It does **not** implement a credential vault, OAuth callback, provider login, connection UI or adapter execution. No credential value is accepted or stored by these functions.

## Data boundary

- `capability_connections` stores owner/principal, provider identifier, explicit scopes, lifecycle timestamps and an opaque `vault://` reference only.
- Secret values must live in a separately provisioned encrypted vault. D1 is not a vault.
- The repository rejects raw-token-looking values, malformed references, traversal segments, wildcard scopes and agent-attributed creation.
- Only one active connection per principal/provider is permitted. An expired active row is retired before a replacement is inserted; the old metadata remains for audit/history.
- Sentinel lookup is exact on trusted principal and provider, and ignores revoked or expired connections.
- Listing strips the vault reference. The trusted Sentinel loader may receive it as a reference, never as credential material.
- Revocation is owner-scoped and returns false for missing, foreign or already-revoked records.

## API

```js
createConnection(db, input, now?)
loadConnection(db, { principalId, providerId }, now?)
listConnections(db, principalId, limit?)
revokeConnection(db, id, principalId, now?)
```

Creation requires `createdBy: 'owner'`. Scope strings are explicit and bounded. Optional expiry is limited to 365 days.

## Migration

`migrations/capabilities/0003_connections.sql` follows the approval migration and the grant migration planned in PR #29. Apply it only after the earlier capability migrations, in order, to the intended D1 database. It has not been applied to any Cloudflare environment.

## Remaining before use

1. Provision an encrypted secret-vault adapter with authenticated put/get/delete, versioning, audit and revocation. Never put the secret value in D1 or model context.
2. Add owner-authenticated connection lifecycle APIs and UI with explicit provider consent.
3. Compose this repository with the grant loader, approval store and audit writer in the trusted Sentinel composition root.
4. Add the reviewed server-owned adapter router and egress controls.
5. Exercise the complete flow in non-production before any deployment.

This is a storage primitive, not a working connected account. No connection can currently be used to access a provider.
