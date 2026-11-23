import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Mergiraf sandbox reproduces an isolated conflict and validates the resolved result', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'aegis-mergiraf-test-'));
  const bin = path.join(temporary, 'bin');
  await mkdir(bin);
  const fakeMergiraf = path.join(bin, 'mergiraf');
  await writeFile(fakeMergiraf, `#!/bin/sh
set -eu
[ "$1" = "solve" ]
[ -f "$2" ]
cat > "$2" <<'YAML'
restaurant:
  tasks:
    plates: 1
    bowls: 4
YAML
`, { mode: 0o755 });

  try {
    const result = spawnSync('bash', ['scripts/mergiraf-sandbox.sh'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /isolated Mergiraf merge passed/i);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
