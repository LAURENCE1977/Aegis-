# AEGIS capability connections — metadata foundation

## Status

This branch builds on the owner-scoped connection metadata repository and adds the AES-GCM vault-backed provider key panel/API. It does not implement OAuth or live model-adapter execution. Stored provider credentials remain vault-only until a separately reviewed runtime integration is completed.

## Data boundary

- `capability_connections` stores owner/principal, provider identifier, explicit scopes, lifecycle timestamps and an opaque `vault://` reference only.
- Secret values must live in a separately provisioned encrypted vault. D1 is not a vault.
- The repository rejects raw-token-looking values, malformed references, traversal segments, wildcard scopes and agent-attributed creation.
- Only one active connection per principal/provider is permitted. An expired active row is retired before a replacement is inserted; the old metadata remains for audit/history.
- Sentinel lookup is exact on trusted principal and provider, and ignores revoked or expired connections.
- Listing strips the vault reference. The trusted Sentinel loader may receive it as a reference, never as credential material.
- Revocation is owner-scoped and returns false for missing, foreign or already-revoked records.

## Owner-facing provider connection API

- `GET /api/model-provider-connections` returns the fixed provider catalogue and redacted connection metadata.
- `POST /api/model-provider-connections` accepts an allowlisted provider ID and API key over an authenticated same-origin request, stores the key in the encrypted vault and returns only safe metadata.
- `DELETE /api/model-provider-connections` revokes the provider connection and erases the stored ciphertext.
- The UI never writes keys to localStorage, chat history or browser logs. It clears the password field after a successful store, on sign-out and when leaving the panel.
- The current status is `vault_only`; a stored key is not proof that the provider is connected to inference.

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

## Remaining before live provider use

1. Provision the vault keyring and active version as Cloudflare Worker secrets; the application does not generate or upload them.
2. Connect each supported provider to its reviewed server-side adapter, resolving credentials only inside trusted server code.
3. Compose provider calls with the resource-pool reservation/settlement flow and explicit paid-use approval.
4. Add redacted invocation audit and fixed-host egress controls.
5. Exercise the complete flow in non-production before any production deployment.

The current UI securely stores credentials but cannot yet use them to access a provider.
