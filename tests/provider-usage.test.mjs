import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractProviderUsage,
  mergeProviderUsage,
  isCompleteProviderUsage,
} from '../functions/lib/provider-usage.mjs';

test('extracts Anthropic input-token usage from message_start without inventing output usage', () => {
  assert.deepEqual(extractProviderUsage({
    type: 'message_start',
    message: { usage: { input_tokens: 321 } },
  }), {
    inputTokens: 321,
    outputTokens: null,
    totalTokens: null,
    source: 'anthropic',
  });
});

test('extracts Anthropic output-token usage from message_delta', () => {
  assert.deepEqual(extractProviderUsage({
    type: 'message_delta',
    usage: { output_tokens: 87 },
  }), {
    inputTokens: null,
    outputTokens: 87,
    totalTokens: null,
    source: 'anthropic',
  });
});

test('extracts complete OpenAI-compatible usage from a provider final chunk', () => {
  assert.deepEqual(extractProviderUsage({
    choices: [],
    usage: { prompt_tokens: 321, completion_tokens: 87, total_tokens: 408 },
  }), {
    inputTokens: 321,
    outputTokens: 87,
    totalTokens: 408,
    source: 'openai-compatible',
  });
});

test('merges split provider usage events without double counting', () => {
  const input = extractProviderUsage({
    type: 'message_start',
    message: { usage: { input_tokens: 321 } },
  });
  const output = extractProviderUsage({
    type: 'message_delta',
    usage: { output_tokens: 87 },
  });
  const merged = mergeProviderUsage(input, output);
  assert.deepEqual(merged, {
    inputTokens: 321,
    outputTokens: 87,
    totalTokens: 408,
    source: 'anthropic',
  });
  assert.equal(isCompleteProviderUsage(merged), true);
});

test('does not call incomplete or absent usage complete', () => {
  assert.equal(isCompleteProviderUsage(null), false);
  assert.equal(isCompleteProviderUsage(extractProviderUsage({
    type: 'message_start',
    message: { usage: { input_tokens: 321 } },
  })), false);
  assert.equal(extractProviderUsage({ choices: [{ delta: { content: 'hello' } }] }), null);
});

test('ignores malformed, negative, fractional and unsafe provider usage values', () => {
  assert.equal(extractProviderUsage({
    usage: { prompt_tokens: -1, completion_tokens: 2, total_tokens: 1 },
  }), null);
  assert.equal(extractProviderUsage({
    usage: { prompt_tokens: 1.5, completion_tokens: 2, total_tokens: 3.5 },
  }), null);
  assert.equal(extractProviderUsage({
    usage: { prompt_tokens: Number.MAX_SAFE_INTEGER + 1, completion_tokens: 2, total_tokens: 3 },
  }), null);
});

test('rejects merging usage records from different provider formats', () => {
  const anthropic = extractProviderUsage({
    type: 'message_start',
    message: { usage: { input_tokens: 10 } },
  });
  const compatible = extractProviderUsage({
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  });
  assert.throws(() => mergeProviderUsage(anthropic, compatible), /source/i);
});
