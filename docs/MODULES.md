# AEGIS Module Registry

The module registry is a descriptive, read-only catalogue of AEGIS capability boundaries.

## Rules

- Module identifiers are stable, lowercase slugs.
- Status is explicitly `available` or `planned`; planned modules are not executable.
- Capabilities describe intended functionality. They are not permission grants.
- Every module currently has an empty `permissions` array.
- Unknown modules and capabilities fail closed.
- No dynamic code loading, plugin execution, or automatic permission granting is supported.
- Registry responses are authenticated and sent with `Cache-Control: no-store`.

## API

Authenticated `GET /api/modules` returns the module catalogue. It returns 503 when authentication secrets are not configured and 401 without a valid session.

## Future permission model

A future grant system must be separate from module metadata. Grants should be scoped to a user, module, capability and (where appropriate) resource; expire where practical; be revocable; be audited; and require explicit approval for sensitive operations. Registry metadata must never be able to grant itself access.
