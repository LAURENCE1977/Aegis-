#!/usr/bin/env bash
set -euo pipefail

MERGIRAF_BIN="${MERGIRAF_BIN:-mergiraf}"
sandbox="$(mktemp -d)"
trap 'rm -rf "$sandbox"' EXIT

git -C "$sandbox" init -q -b main
git -C "$sandbox" config user.name "AEGIS Merge Sandbox"
git -C "$sandbox" config user.email "aegis-merge-sandbox@example.invalid"
git -C "$sandbox" config merge.conflictStyle diff3

cat > "$sandbox/config.yml" <<'YAML'
tasks:
  plates: 1
  bowls: 2
YAML
git -C "$sandbox" add config.yml
git -C "$sandbox" commit -qm "base"

git -C "$sandbox" switch -q -c nest-tasks
cat > "$sandbox/config.yml" <<'YAML'
restaurant:
  tasks:
    plates: 1
    bowls: 2
YAML
git -C "$sandbox" commit -qam "nest tasks under restaurant"

git -C "$sandbox" switch -q main
git -C "$sandbox" switch -q -c update-bowls
cat > "$sandbox/config.yml" <<'YAML'
tasks:
  plates: 1
  bowls: 4
YAML
git -C "$sandbox" commit -qam "update bowl count"

git -C "$sandbox" switch -q nest-tasks
if git -C "$sandbox" merge update-bowls --no-edit; then
  echo "Expected the fixture branches to produce a content conflict."
  exit 1
else
  merge_status=$?
  if [ "$merge_status" -ne 1 ]; then
    echo "Git merge failed for a reason other than the expected content conflict."
    exit "$merge_status"
  fi
fi

if ! grep -q '^<<<<<<< ' "$sandbox/config.yml"; then
  echo "Expected Git to leave conflict markers before invoking Mergiraf."
  exit 1
fi

"$MERGIRAF_BIN" solve "$sandbox/config.yml"

cat > "$sandbox/expected.yml" <<'YAML'
restaurant:
  tasks:
    plates: 1
    bowls: 4
YAML
if grep -Eq '^(<<<<<<<|=======|>>>>>>>|\|\|\|\|\|\|\|) ' "$sandbox/config.yml"; then
  echo "Mergiraf left unresolved conflict markers."
  exit 1
fi
diff -u "$sandbox/expected.yml" "$sandbox/config.yml"
git -C "$sandbox" add config.yml
git -C "$sandbox" -c user.name="AEGIS Merge Sandbox" -c user.email="aegis-merge-sandbox@example.invalid" commit -qm "accept reviewed fixture resolution"

echo "Isolated Mergiraf merge passed: conflict reproduced, syntax-aware resolution validated, and sandbox cleaned up."
