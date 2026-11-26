#!/usr/bin/env bash
#
# End-to-end local Cloudflare D1 migration test for AEGIS.
#
# Applies the real production migration files in three stages:
#   0001-0013 -> legacy fixture -> 0014 -> 0015-0018
# Then executes the production legacy-owner assertion against the same
# isolated local D1 database.
#
# This script is deliberately local-only. It never accepts --remote and
# generates a unique D1 database ID plus a per-run persistence directory.

set -Eeuo pipefail

readonly SCRIPT_NAME="${0##*/}"
readonly REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  printf 'ERROR: run this script from inside the AEGIS Git repository.\n' >&2
  exit 2
}
readonly MIGRATIONS_DIR="$REPO_ROOT/migrations/production"
readonly FIXTURE_SQL="$REPO_ROOT/scripts/legacy-fixture.sql"
readonly ASSERT_SQL="$REPO_ROOT/scripts/production-legacy-owner-assert.sql"
readonly LOCAL_DATA_ROOT="$REPO_ROOT/local-d1-data"
readonly DB_NAME="aegis-local-migration-harness"

WRANGLER_BIN="${WRANGLER_BIN:-wrangler}"
KEEP_LOCAL_D1="${AEGIS_KEEP_LOCAL_D1:-0}"
RUN_DIR=""

readonly -a EXPECTED_MIGRATIONS=(
  0001_approvals.sql
  0002_grants.sql
  0003_connections.sql
  0004_secret_vault.sql
  0005_invocation_audit.sql
  0006_invocation_limits.sql
  0007_project_spaces.sql
  0008_system_state.sql
  0009_auth_sessions.sql
  0010_login_attempts.sql
  0011_memories.sql
  0012_memory_lifecycle_audit.sql
  0013_memory_supersedes.sql
  0014_tenant_identity.sql
  0015_multi_principal_provisioning.sql
  0016_identity_credential_versioning.sql
  0017_invitations_and_credential_rotation.sql
  0018_memory_cursor_index.sql
)

log() {
  printf '[%s] %s\n' "$SCRIPT_NAME" "$*"
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

on_exit() {
  local status="$1"

  if [[ -z "$RUN_DIR" || ! -d "$RUN_DIR" ]]; then
    return
  fi

  # Guard cleanup so a malformed variable can never target outside the
  # repository's dedicated local D1 data directory.
  case "$RUN_DIR" in
    "$LOCAL_DATA_ROOT"/fresh-*) ;;
    *)
      printf 'WARNING: refusing to clean unexpected path: %s\n' "$RUN_DIR" >&2
      return
      ;;
  esac

  if [[ "$status" -eq 0 && "$KEEP_LOCAL_D1" != "1" ]]; then
    rm -rf -- "$RUN_DIR"
    log "Removed successful isolated database state."
  else
    log "Preserved isolated database state for inspection: $RUN_DIR"
  fi
}

trap 'on_exit "$?"' EXIT

command -v git >/dev/null 2>&1 || die "git is required."
command -v node >/dev/null 2>&1 || die "Node.js is required to generate an isolated D1 database ID."
command -v "$WRANGLER_BIN" >/dev/null 2>&1 || die "Wrangler CLI not found. Install/pin Wrangler in the project environment; this script will not download an unpinned version."

[[ -d "$MIGRATIONS_DIR" && ! -L "$MIGRATIONS_DIR" ]] || die "Migration directory is missing or is a symlink: $MIGRATIONS_DIR"
[[ -f "$FIXTURE_SQL" && ! -L "$FIXTURE_SQL" ]] || die "Legacy fixture is missing or is a symlink: $FIXTURE_SQL"
[[ -f "$ASSERT_SQL" && ! -L "$ASSERT_SQL" ]] || die "Legacy-owner assertion is missing or is a symlink: $ASSERT_SQL"

if [[ -L "$LOCAL_DATA_ROOT" ]]; then
  die "Refusing to use symlinked local data root: $LOCAL_DATA_ROOT"
fi
mkdir -p -- "$LOCAL_DATA_ROOT"
RUN_DIR="$(mktemp -d "$LOCAL_DATA_ROOT/fresh-XXXXXX")"

WRANGLER_VERSION="$("$WRANGLER_BIN" --version 2>&1)" || die "Unable to obtain Wrangler version."
log "Wrangler: $WRANGLER_VERSION"
log "Isolated local state: $RUN_DIR"

# Enforce an exact, complete migration ledger in the repository. No missing,
# duplicate, unexpected, or symlinked SQL migration files are accepted.
shopt -s nullglob
actual_files=("$MIGRATIONS_DIR"/*.sql)
shopt -u nullglob
[[ "${#actual_files[@]}" -eq "${#EXPECTED_MIGRATIONS[@]}" ]] || die "Expected exactly 18 production migration SQL files; found ${#actual_files[@]}."

for i in "${!EXPECTED_MIGRATIONS[@]}"; do
  expected="${EXPECTED_MIGRATIONS[$i]}"
  actual="${actual_files[$i]}"
  [[ "$(basename "$actual")" == "$expected" ]] || die "Migration ledger mismatch at position $((i + 1)): expected $expected, found $(basename "$actual")."
  [[ -f "$actual" && ! -L "$actual" ]] || die "Migration must be a regular, non-symlink file: $actual"
done

DB_ID="$(node -e 'process.stdout.write(require("node:crypto").randomUUID())')"
PERSIST_DIR="$RUN_DIR/persist"
mkdir -p -- "$PERSIST_DIR"

write_stage() {
  local stage="$1"
  shift
  local stage_dir="$RUN_DIR/stages/$stage"
  local config="$RUN_DIR/wrangler-$stage.toml"

  mkdir -p -- "$stage_dir"
  for migration in "$@"; do
    cp -- "$MIGRATIONS_DIR/$migration" "$stage_dir/$migration"
  done

  cat > "$config" <<EOF
name = "$DB_NAME"
compatibility_date = "2026-11-25"

[[d1_databases]]
binding = "AEGIS_DB"
database_name = "$DB_NAME"
database_id = "$DB_ID"
migrations_dir = "stages/$stage"
EOF

  printf '%s\n' "$config"
}

run_migrations() {
  local stage="$1"
  local config="$2"
  log "Applying migration stage $stage locally."
  "$WRANGLER_BIN" d1 migrations apply "$DB_NAME" \
    --local \
    --config "$config" \
    --persist-to "$PERSIST_DIR"
}

run_sql_file() {
  local description="$1"
  local config="$2"
  local sql_file="$3"
  log "$description"
  "$WRANGLER_BIN" d1 execute "$DB_NAME" \
    --local \
    --config "$config" \
    --persist-to "$PERSIST_DIR" \
    --file "$sql_file"
}

STAGE_0013_CONFIG="$(write_stage 0001-0013 "${EXPECTED_MIGRATIONS[@]:0:13}")"
STAGE_0014_CONFIG="$(write_stage 0014 "${EXPECTED_MIGRATIONS[13]}")"
STAGE_0018_CONFIG="$(write_stage 0015-0018 "${EXPECTED_MIGRATIONS[@]:14:4}")"

# Phase A: establish the authentic pre-identity schema.
run_migrations "0001-0013" "$STAGE_0013_CONFIG"

# Phase B: seed legacy owner records while the pre-0014 schema is active.
run_sql_file "Seeding pre-0014 legacy owner fixture." "$STAGE_0013_CONFIG" "$FIXTURE_SQL"

# Phase C: run identity migration independently so its backfill is a distinct
# migration boundary and not hidden inside a single all-at-once invocation.
run_migrations "0014" "$STAGE_0014_CONFIG"

# Phase D: add membership, credential, invitation and cursor-index migrations.
run_migrations "0015-0018" "$STAGE_0018_CONFIG"

# Phase E: certify the completed 18-migration legacy database.
run_sql_file "Running production legacy-owner assertion against local D1." "$STAGE_0018_CONFIG" "$ASSERT_SQL"

log "PASS: migrations 0001-0018 applied and production-legacy-owner-assert.sql completed successfully."
log "No remote/production D1 command was issued."
