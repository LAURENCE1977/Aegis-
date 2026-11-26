# AEGIS Production D1 Migration Runbook

**Scope:** production migration ledger `migrations/production/0001` through `0017` for Cloudflare Pages + D1.
**Status:** procedure only. No production D1 operation is authorised by this document or by the Step 2.6.13 audit.

## 0. Hard stop conditions

Do not proceed unless all are true:

- The owner has approved the exact PR, production deployment, migration window and rollback authority.
- The Pages project is confirmed to be the AEGIS project and its production D1 binding points to the intended database.
- The configured D1 database exists and its ID matches `wrangler.toml`.
- The deployed application version is compatible with the full migration chain.
- A tested backup/export and a current D1 Time Travel bookmark have been secured.
- The migration ledger is understood; no unknown or manually-applied schema changes are present.

**Current audit observation (26 November 2026):** the connected Cloudflare account's read-only D1 inventory returned zero databases, while the repository's `wrangler.toml` contains a D1 database ID. The Pages project API could not be authenticated by the available read-only connection. Treat the binding as unverified and STOP. Do not create a D1 database, change a binding, or run a remote command as part of this audit.

## 1. Pre-flight and backup

Run from the reviewed repository checkout, after confirming the active Wrangler account/profile and production database name:

```sh
wrangler whoami
wrangler d1 info aegis-production
wrangler d1 migrations list aegis-production --remote
wrangler d1 time-travel info aegis-production
```

Record the database ID, D1 storage `version`, current bookmark, timestamp, active Pages deployment ID and current Git commit in the change record. Confirm the database uses the production storage backend if relying on Time Travel.

Create a full SQL export and store it outside the repository in encrypted, access-controlled storage. The export can contain personal data and credential hashes; never attach it to a PR, commit it, or leave it in a public build artifact.

```sh
umask 077
BACKUP_FILE="$HOME/aegis-production-pre-0017-$(date -u +%Y%m%dT%H%M%SZ).sql"
wrangler d1 export aegis-production --remote --output "$BACKUP_FILE"
sha256sum "$BACKUP_FILE"
```

Record the export path, SHA-256 digest, size, retention location and operator. Retain the Time Travel bookmark separately. An export is an additional recovery artefact; it is not a substitute for verifying that a restore procedure is available.

Inspect the migration ledger:

```sh
wrangler d1 execute aegis-production --remote \
  --command "SELECT id, name, applied_at FROM d1_migrations ORDER BY id"
```

Compare the recorded names with the exact ordered filenames in `migrations/production/`. There must be no gaps, unexpected names, duplicate manual schema changes or unknown migrations. If the database has an older legitimate prefix, document it and confirm the remaining pending migrations are exactly the intended suffix. Do not edit historical migration files to make the ledger appear to match.

## 2. Provision runtime configuration

Provision configuration in the Cloudflare Pages **production** environment before activating the new application code. Configure Preview separately if it is used. Never put secret values in Git, `wrangler.toml`, browser variables, CI logs or chat.

| Name | Cloudflare setting | Requirement |
|---|---|---|
| `AEGIS_SESSION_SECRET` | Encrypted secret | Required. Generate a unique cryptographically random value of at least 32 characters. |
| `AEGIS_PASSWORD` | Encrypted secret | Required for the root bootstrap login; unique and at least 12 characters. |
| `AEGIS_PASSWORD_PEPPER_KEYRING` | Encrypted secret | Required for the versioned named-principal credential keyring. JSON object of version-to-secret mappings; each pepper must be 32–512 characters; maximum eight versions. |
| `AEGIS_PASSWORD_PEPPER_ACTIVE_VERSION` | Plain environment variable, **not a secret** | Required with the keyring. Must exactly name a key present in the keyring. |
| `ANTHROPIC_API_KEY` | Encrypted secret | Optional; only if the Anthropic adapter is intentionally selected. |
| `AEGIS_QWEN_API_KEY` | Encrypted secret | Optional; only if the Alibaba Qwen adapter is intentionally selected. |

For the Workers AI default, no third-party provider key is required. Provider-specific non-secret settings such as `AEGIS_MODEL_PROVIDER`, `AEGIS_ANTHROPIC_MODEL`, Qwen workspace ID, region and model must be configured only for an approved provider. A GitHub Actions secret is not automatically available to Cloudflare Pages runtime.

Keep legacy pepper material available until every credential using that version has been rehashed or reset. Verify credential counts by pepper version before retiring any old key. Never print pepper values while doing so.

## 3. Apply the migration chain

Only after the PR is approved/merged, the production D1 binding is independently verified, the backup/bookmark is recorded and the migration window is authorised:

```sh
wrangler d1 migrations list aegis-production --remote
wrangler d1 migrations apply aegis-production --remote
wrangler d1 migrations list aegis-production --remote
wrangler d1 execute aegis-production --remote \
  --command "SELECT id, name, applied_at FROM d1_migrations ORDER BY id"
wrangler d1 execute aegis-production --remote \
  --command "PRAGMA foreign_key_check"
```

Use the exact reviewed Wrangler version pinned by the deployment procedure. Capture complete command output in the restricted change record. Confirm the intended migration suffix is applied in order and the foreign-key check returns no rows. Stop on any unexpected result; do not manually rerun SQL from a failed migration.

The migrations are ordered, one-time schema changes tracked by D1's `d1_migrations` ledger. Do not assume every historical SQL file is safe to execute repeatedly. Never edit or replay an already-applied migration; create a new forward migration for later schema changes.

## 4. Deploy and smoke-test

Deploy only the reviewed commit through the approved Cloudflare Pages deployment path. Keep the previous successful Pages deployment available for immediate application rollback.

1. Generic health endpoint:

   ```sh
   curl --fail --silent --show-error "$BASE_URL/api/health"
   ```

   Expect HTTP 200 and `{"ok":true,"service":"aegis-infinity"}`.

2. Root bootstrap login: enter the root password through a secure prompt or secret manager, not a command-line literal or shell history. POST only the password field to `/api/login` with the correct same-origin `Origin` header; store the returned Secure/HttpOnly cookie in a private temporary cookie jar. Confirm `GET /api/login` returns `authenticated: true` and the root membership is `org-root` with owner role. Do not print the cookie or password.

3. Session revocation: call `DELETE /api/login` using the test cookie jar and confirm a subsequent `GET /api/login` returns `authenticated: false`. This validates current-session revocation.

4. Named-principal password rotation: do not attempt this with `usr-root`—the root bootstrap password is Cloudflare-secret-managed and the endpoint intentionally returns 409 for root. In a controlled test tenant, use a temporary non-root test principal, establish two sessions, rotate its password through `POST /api/account/password`, verify the current session remains usable and the other session is rejected, then suspend/remove the test principal and securely discard temporary credentials.

5. Verify invitation and recovery flows with test identities only, including wrong-tenant rejection, expiry and replay rejection. Never use a real person's recovery token as a smoke-test fixture.

6. Recheck D1 migration ledger, `PRAGMA foreign_key_check`, Pages deployment status, error logs and session creation/revocation behaviour. Record the deployed commit and test evidence.

## 5. Rollback decision tree

**Application-only regression with a healthy additive schema:**

- Stop further rollout and disable any newly activated feature/provider switch.
- Roll back the Pages deployment to the last known-good deployment.
- Leave the additive D1 schema in place unless there is verified data/schema corruption. Do not run reverse SQL or drop new tables as a routine code rollback.
- Verify the old application works against the expanded schema, then investigate and prepare a forward fix.

**Migration-induced schema/data corruption or incompatible state:**

- Declare an incident, stop writes/traffic and obtain explicit owner approval for a destructive database restore.
- Confirm the exact pre-migration Time Travel bookmark from the change record and verify the target database ID one more time.
- Restore to that bookmark:

  ```sh
  wrangler d1 time-travel restore aegis-production --remote --bookmark="$PRE_MIGRATION_BOOKMARK"
  ```

- Capture the restore output, especially the returned current and previous bookmarks. The restore overwrites the database and can discard all writes after the bookmark. Preserve the previous bookmark so the restore itself can be undone if necessary.
- Roll the Pages application back to the code version compatible with the restored schema.
- Re-run health, root login, session revocation, migration-ledger and foreign-key checks. Confirm the restored schema and data before reopening writes.

If Time Travel is unavailable for the database's storage version or the bookmark is outside the plan's retention window, STOP and use the separately rehearsed export/import recovery plan with a new verified D1 target and an owner-approved binding cutover. Do not improvise an in-place restore.

## 6. Completion record

Record: PR and reviewed commit; production deployment ID; D1 name and ID; pre/post migration ledger; export SHA-256 and secure location; Time Travel bookmark; Wrangler version; secret *names and presence only* (never values); smoke-test outcomes; foreign-key check; operator and approval; and any rollback/incident decision.
