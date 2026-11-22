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
    message: { usage: { input_tokens: 321, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } },
  }), {
    inputTokens: 321,
    outputTokens: null,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
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
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    totalTokens: 408,
    source: 'openai-compatible',
  });
});

test('merges split provider usage events without double counting', () => {
  const input = extractProviderUsage({
    type: 'message_start',
    message: { usage: { input_tokens: 321, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } },
  });
  const output = extractProviderUsage({
    type: 'message_delta',
    usage: { output_tokens: 87 },
  });
  const merged = mergeProviderUsage(input, output);
  assert.deepEqual(merged, {
    inputTokens: 321,
    outputTokens: 87,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    totalTokens: 408,
    source: 'anthropic',
  });
  assert.equal(isCompleteProviderUsage(merged), true);
});

test('does not call incomplete or absent usage complete', () => {
  assert.equal(isCompleteProviderUsage(null), false);
  assert.equal(isCompleteProviderUsage(extractProviderUsage({
    type: 'message_start',
    message: { usage: { input_tokens: 321, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } },
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
    message: { usage: { input_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } },
  });
  const compatible = extractProviderUsage({
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  });
  assert.throws(() => mergeProviderUsage(anthropic, compatible), /source/i);
});

test('includes Anthropic cache creation and cache read tokens in the reported total', () => {
  const input = extractProviderUsage({
    type: 'message_start',
    message: { usage: {
      input_tokens: 100,
      cache_creation_input_tokens: 25,
      cache_read_input_tokens: 40,
    } },
  });
  const output = extractProviderUsage({
    type: 'message_delta',
    usage: { output_tokens: 15 },
  });
  const merged = mergeProviderUsage(input, output);
  assert.deepEqual(merged, {
    inputTokens: 100,
    outputTokens: 15,
    cacheCreationInputTokens: 25,
    cacheReadInputTokens: 40,
    totalTokens: 180,
    source: 'anthropic',
  });
  assert.equal(isCompleteProviderUsage(merged), true);
});

test('does not mark Anthropic usage complete when cache token fields are omitted', () => {
  const partial = extractProviderUsage({
    type: 'message_start',
    message: { usage: { input_tokens: 100 } },
  });
  const output = extractProviderUsage({
    type: 'message_delta',
    usage: { output_tokens: 15 },
  });
  assert.equal(isCompleteProviderUsage(mergeProviderUsage(partial, output)), false);
});
