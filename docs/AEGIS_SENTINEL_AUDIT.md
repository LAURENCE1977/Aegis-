# AEGIS Sentinel invocation audit

## Status

This is a D1-backed append-only audit repository for the existing Sentinel event shape. It is a storage primitive; it is not yet wired into the agent runtime's trusted composition root.

## Recorded fields

Each event stores invocation ID, event type, trusted principal ID, capability ID/version, action ID, exact resource ID, canonical SHA-256 input digest, bounded reason code and ISO timestamp. The repository rejects unknown fields, including raw inputs or credential values.

Supported event types: `invocation_denied`, `invocation_policy_allowed`, `invocation_authorized`, `invocation_failed` and `invocation_succeeded`.

The migration creates principal/time and invocation indexes plus database triggers that reject UPDATE and DELETE. The repository exposes a bounded owner-scoped read function for later Security Centre integration.

## Integration requirement

The trusted Sentinel composition root must pass `recordCapabilityAudit` as its `recordAudit` dependency. Audit persistence must succeed before an adapter is allowed to execute; the existing Sentinel function already fails closed on pre-execution audit failure. Do not log raw inputs, secret material, authorization headers, provider responses or model prompts.

## Migration

Apply `migrations/capabilities/0005_invocation_audit.sql` after approvals, grants, connection metadata and encrypted vault migrations, in order, to the intended D1 database. It has not been applied to any environment.

No runtime execution path or deployment is enabled by this document.
