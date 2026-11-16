import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('the signed-in home is companion-first and exposes an accessible presentation stage', () => {
  assert.match(html, /<section[^>]+id="companionStage"[^>]+aria-labelledby="companionTitle"/);
  assert.match(html, /id="companionVisual"/);
  assert.match(html, /id="companionTitle"/);
  assert.match(html, /id="companionStatus"/);
  const stage = html.indexOf('id="companionStage"');
  const chat = html.indexOf('id="chatBox"');
  assert.ok(stage >= 0 && chat > stage, 'companion stage must appear before the conversation');
  assert.match(html, /aria-label="AEGIS companion presentation"/);
});

test('the companion presentation is honest about the avatar runtime and does not impersonate a live human', () => {
  assert.match(html, /companion presentation layer/i);
  assert.match(html, /interactive avatar runtime is in development/i);
  assert.match(html, /aria-live="polite"/);
});

test('the companion stage adapts to narrow screens and respects reduced-motion preferences', () => {
  assert.match(html, /\.companion-stage[\s\S]*?@media\s*\(max-width:\s*820px\)/);
  assert.match(html, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('the existing chat controls remain present after the companion stage is added', () => {
  for (const id of ['chatBox', 'userInput', 'sendBtn', 'chatProjectSelect', 'status']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
});
