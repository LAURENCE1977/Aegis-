import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestPost } from '../functions/api/ask.js';

const secret = 'ask-provider-test-session-secret-long-enough';
const envBase = {
  AEGIS_PASSWORD: 'test-password-long-enough',
  AEGIS_SESSION_SECRET: secret,
};

async function request(body) {
  return new Request('https://aegis.example/api/ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://aegis.example',
      Cookie: '__Host-aegis_session=' + await createSessionToken(secret),
    },
    body: JSON.stringify(body),
  });
}

function sseStream(frames) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
}

test('/api/ask uses the configured Anthropic adapter without requiring a Workers AI binding', async () => {
  let captured;
  const response = await onRequestPost({
    request: await request({ question: 'Hello AEGIS' }),
    env: {
      ...envBase,
      AEGIS_MODEL_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'test-anthropic-key-long-enough',
      AEGIS_ANTHROPIC_MODEL: 'claude-test-model',
    },
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return new Response(sseStream([
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello from "}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Anthropic"}}\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      ]), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { response: 'Hello from Anthropic' });
  assert.equal(captured.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(captured.options.redirect, 'error');
  assert.equal(captured.options.headers.Authorization, 'Bearer test-anthropic-key-long-enough');
});

test('/api/ask uses the configured Qwen adapter rather than calling Workers AI directly', async () => {
  let captured;
  const response = await onRequestPost({
    request: await request({ question: 'Hello AEGIS' }),
    env: {
      ...envBase,
      AEGIS_MODEL_PROVIDER: 'alibaba-qwen',
      AEGIS_QWEN_API_KEY: 'test-qwen-api-key-long-enough',
      AEGIS_QWEN_WORKSPACE_ID: 'workspace-123',
      AEGIS_QWEN_REGION: 'ap-southeast-1',
      AEGIS_QWEN_MODEL: 'qwen3.8-flash',
    },
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return new Response(sseStream([
        'data: {"choices":[{"delta":{"content":"Hello from Qwen"}}]}\n\n',
        'data: [DONE]\n\n',
      ]), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { response: 'Hello from Qwen' });
  assert.equal(captured.url, 'https://workspace-123.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions');
  assert.equal(captured.options.redirect, 'error');
});

test('/api/ask keeps the Workers AI default adapter and JSON response contract', async () => {
  let model;
  let payload;
  const response = await onRequestPost({
    request: await request({ question: 'Hello AEGIS' }),
    env: {
      ...envBase,
      AI: {
        async run(selectedModel, input) {
          model = selectedModel;
          payload = input;
          return sseStream(['data: {"response":"Hello from Workers AI"}\n\n', 'data: [DONE]\n\n']);
        },
      },
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { response: 'Hello from Workers AI' });
  assert.equal(model, '@cf/meta/llama-3.3-70b-instruct');
  assert.equal(payload.stream, true);
});

test('/api/ask cancels an oversized provider stream after enforcing the output cap', async () => {
  let cancelled = false;
  const response = await onRequestPost({
    request: await request({ question: 'Hello AEGIS' }),
    env: {
      ...envBase,
      AI: {
        async run() {
          return new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(
                'data: ' + JSON.stringify({ response: 'x'.repeat(12001) }) + '\n\n',
              ));
            },
            cancel() { cancelled = true; },
          });
        },
      },
    },
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.response.length, 12000);
  assert.equal(cancelled, true);
});
