# AEGIS Update & Maintenance System

**Status: policy foundation implemented; update delivery and installation are not yet implemented.**

## Goal

Keep AEGIS maintainable after its first release, like a supported operating system. Updates must be independently versioned, discoverable, verifiable, staged, approved according to risk, applied safely, observable and reversible.

## Update classes

- **Security:** vulnerability fixes, dependency patches, key/permission hardening and urgent mitigations.
- **Bug fix:** correctness and reliability fixes.
- **Feature:** new first-party capabilities and optional modules.
- **Compatibility:** API, MCP, model-provider and platform compatibility changes.
- **Maintenance:** performance, documentation, migrations and supported-runtime updates.

## Release manifest

Every release is described by a versioned JSON manifest with:
- schema version, product, semantic version, release channel and timestamp;
- minimum supported AEGIS version;
- platform-specific artifact URLs and SHA-256 digests;
- human-readable, typed change notes;
- explicit security-update, permission-change and database-migration flags.

The first policy implementation lives in `functions/lib/update-policy.mjs`. It validates the manifest, classifies risk and permits automatic application only for a valid stable patch release in the same major/minor line, with no security, permission or database-migration changes. The running version must meet the release's minimum-version requirement.

## Required lifecycle

1. **Discover:** check a configured, signed release index on a bounded schedule or on user request. No arbitrary manifest URL supplied by an untrusted caller.
2. **Verify:** validate schema, signature, version/channel policy, artifact digest, provenance and compatibility before trusting release metadata.
3. **Assess:** show release notes, affected modules, licence changes, required storage, migration impact, security advisories and expected downtime.
4. **Stage:** download to an isolated staging area; verify digest and signature again; never execute update code in the control plane.
5. **Test:** run compatibility checks, migrations against a disposable copy, health checks and module tests.
6. **Approve:** low-risk patch updates may become eligible for a user-configured unattended policy. Security fixes, permission changes, migrations, major/minor upgrades and core replacement require explicit Sentinel approval. Emergency security mode may block affected capabilities immediately, but must not silently grant permissions or deploy unreviewed code.
7. **Apply:** use an atomic version switch or deployment promotion where supported. Keep the previous known-good version.
8. **Verify:** health-check the updated system and record the exact version, manifest digest, actor, approval, checks and result in append-only audit history.
9. **Rollback:** automatically revert a failed health check where safe; otherwise stop, preserve diagnostics and require owner intervention. Database migrations must be backward-compatible or have a tested restore strategy; never assume a destructive migration can be reversed.
10. **Report:** display current version, available updates, channel, last check, last successful update, failures, rollback state and security advisories.

## Sentinel and security boundaries

- Sentinel remains the authority for update permissions and approvals.
- Update discovery is read-only. Discovery must never install or execute anything.
- Release signing keys are pinned/trusted out of band; TLS and SHA-256 alone do not prove publisher authenticity.
- Verify signed metadata and artifact digests before staging and immediately before activation.
- Default channel is stable. Beta/nightly opt-in is explicit.
- No third-party module can update AEGIS core or change its own permissions.
- Updates cannot broaden grants, reveal secrets, alter audit history or bypass owner approval.
- Keep an append-only update event trail and a software bill of materials for every release.
- Never auto-upgrade a paid service, enable paid usage or provision cloud resources.

## Free and open-source requirement

The updater, release metadata format, verification, staging, health checks and rollback orchestration must remain open source and self-hostable. AEGIS must not require a paid update service. Public release hosting may use a replaceable static HTTPS origin; self-hosted mirrors must be supported. Any hosted infrastructure cost must be disclosed.

## Delivery roadmap

1. **Done:** pure update-manifest validation, risk classification and conservative auto-apply eligibility policy, with unit tests.
2. **Next:** signed release manifest format and trusted-key rotation/revocation design.
3. **Next:** read-only update-check endpoint and owner-facing update status.
4. **Next:** isolated staging, artifact verification and compatibility test runner.
5. **Next:** Sentinel approval workflow and immutable update audit records.
6. **Next:** atomic activation, health checks and rollback for Pages/Worker/module deployment targets.
7. **Later:** optional modules, update channels, staged rollouts, offline bundles and multi-device fleet reporting.

Do not describe the update system as operational until discovery, signature verification, staging, approval, installation, health checks and rollback have all been implemented and tested end-to-end.
