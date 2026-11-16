# AEGIS persistent capability grants

## Status
This is the persistent D1 grant repository ported onto the clean Native Memory Substrate branch. It is a storage/policy-context primitive; it does not by itself enable capability execution or grant any permission automatically.

## Grant contract
- Every grant is attributed to the trusted owner/principal and one exact registered capability/version.
- Grants bind explicit scopes and exact resource IDs. Wildcards are rejected.
- Grant expiry is bounded to 90 days; revocation is owner-scoped and blocks future Sentinel checks.
- The Sentinel loader performs exact principal, capability/version and resource matching and returns no match for revoked or expired grants.
- Agent roles, model plans, capability catalogue entries and manifest review status never create grants.
- Browser/model callers cannot choose the trusted principal or call storage primitives directly.

## Migration
Apply `migrations/capabilities/0002_grants.sql` after `0001_approvals.sql`, then apply `0003_connections.sql`, `0004_secret_vault.sql` and `0005_invocation_audit.sql` in order to the same intended D1 database. These migrations are source only and have not been applied to Cloudflare.

## Current boundary
The grant store, connection metadata, AES-GCM vault and append-only audit are libraries and schemas. They are not yet composed into a live authenticated API or agent runtime. The encrypted vault requires separately provisioned Worker keyring secrets; none have been generated or configured. The audit writer must be wired into Sentinel before any adapter can execute. No provider connection, external action, D1 provisioning or production deployment is enabled.

## Required next step
Build the trusted server-side composition root that loads the exact manifest, active grant, connection and approval; resolves vault material only after authorization; persists the pre-execution audit; invokes a fixed allowlisted adapter; and records a redacted outcome. Keep all paths fail-closed and test with a disposable non-production D1 database before provisioning production resources.
