# AEGIS encrypted secret vault

## Status

The native vault primitive uses Web Crypto AES-256-GCM. It is a server-side library, not a user-facing credential manager. It has no OAuth callback, provider UI or live provider integration yet.

## Key management

The Worker must receive two encrypted deployment secrets:

- `AEGIS_VAULT_KEYRING`: JSON object mapping version labels such as `v1` to Base64-encoded 32-byte random keys.
- `AEGIS_VAULT_ACTIVE_KEY_VERSION`: the version used for new writes.

Keep the keyring in the Worker secret store, never in D1, source control, browser code, logs or model context. Retain prior key versions in the keyring until every ciphertext written with them has been migrated or intentionally revoked. Rotate by adding a new key version and changing the active version; old versions remain readable while present.

No key has been generated, configured or uploaded by this change.

## Cryptographic design

- AES-256-GCM with a fresh 96-bit random IV per secret and a 128-bit authentication tag.
- Authenticated additional data binds ciphertext to vault schema version, secret ID, trusted principal, provider and key version.
- D1 stores only Base64 IV/ciphertext, owner/provider metadata, key version and lifecycle timestamps.
- Secret plaintext is bounded to 16 KiB and is returned only by the trusted server-side resolver after exact owner/provider/reference lookup.
- Tampered ciphertext, missing key versions and malformed key material fail closed.
- Revocation clears IV and ciphertext while retaining a minimal metadata tombstone.

## API

```js
storeVaultSecret(db, { principalId, providerId, secret }, env, now?)
resolveVaultSecret(db, { principalId, providerId, secretRef }, env)
revokeVaultSecret(db, { principalId, providerId, secretRef }, now?)
```

The resolver must only be called from a trusted Sentinel-approved adapter path. Never pass its plaintext return value to an agent, model prompt, browser client or audit record.

## Migration and remaining integration

Apply `migrations/capabilities/0004_secret_vault.sql` after the earlier capability migrations, in order, to the intended D1 database. It has not been applied to any environment.

Before provider use, add owner-authenticated connection setup and deletion flows, safe key provisioning/rotation procedures, Sentinel composition with exact grants and single-use approvals, redacted invocation audit, and a fixed-host adapter router with SSRF/redirect/response/deadline controls. Validate all of this in non-production before any deployment.
