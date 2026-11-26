import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Pages Functions run only for AEGIS API and MCP endpoints', async () => {
  const source = await readFile(new URL('../_routes.json', import.meta.url), 'utf8');
  const routes = JSON.parse(source);

  assert.equal(routes.version, 1);
  assert.deepEqual([...routes.include].sort(), ['/api/*', '/mcp'].sort());
  assert.deepEqual(routes.exclude, []);
  assert.equal(routes.include.includes('/*'), false);
});
