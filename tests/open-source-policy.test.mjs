import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(new URL('../.github/workflows/tests.yml', import.meta.url), 'utf8');

test('CI pins the Miniflare runtime emulator to an exact version', () => {
  assert.match(workflow, /miniflare@\d+\.\d+\.\d+/);
  assert.doesNotMatch(workflow, /miniflare@(?:latest|\d+|\^|~)/);
});

test('CI pins Wrangler to the exact version verified by the D1 integration run', () => {
  assert.match(workflow, /wrangler@4\.163\.0/);
  assert.doesNotMatch(workflow, /wrangler@(?:latest|4|4\.\*|\^4|~4)(?:\s|$)/);
});

test('CI uses a fixed Node.js major version', () => {
  assert.match(workflow, /node-version:\s*22\s*$/m);
  assert.doesNotMatch(workflow, /node-version:\s*['"]?lts\//i);
});
