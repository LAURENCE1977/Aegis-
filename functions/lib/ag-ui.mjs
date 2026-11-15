const EVENT_TYPES = new Set([
  'TEXT_MESSAGE_START','TEXT_MESSAGE_CONTENT','TEXT_MESSAGE_END','TEXT_MESSAGE_CHUNK',
  'TOOL_CALL_START','TOOL_CALL_ARGS','TOOL_CALL_END','TOOL_CALL_CHUNK','TOOL_CALL_RESULT',
  'STATE_SNAPSHOT','STATE_DELTA','MESSAGES_SNAPSHOT','ACTIVITY_SNAPSHOT','ACTIVITY_DELTA',
  'RAW','CUSTOM','RUN_STARTED','RUN_FINISHED','RUN_ERROR','STEP_STARTED','STEP_FINISHED',
  'REASONING_START','REASONING_MESSAGE_START','REASONING_MESSAGE_CONTENT',
  'REASONING_MESSAGE_END','REASONING_MESSAGE_CHUNK','REASONING_END',
  'REASONING_ENCRYPTED_VALUE','SUBAGENT_STARTED','SUBAGENT_FINISHED','SUBAGENT_ERROR',
]);

const MAX_IDENTIFIER = 128;
const MAX_MESSAGE = 12000;
const MAX_EVENT_BYTES = 16384;

function requireIdentifier(value, label) {
  if (typeof value !== 'string' || !value.trim() ||
      value.length > MAX_IDENTIFIER || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError('Invalid AG-UI ' + label);
  }
}

export function createTextRunEvents({ threadId, runId, message, now = Date.now() }) {
  requireIdentifier(threadId, 'thread ID');
  requireIdentifier(runId, 'run ID');
  if (typeof message !== 'string' || message.length > MAX_MESSAGE) {
    throw new TypeError('Invalid AG-UI message');
  }
  if (!Number.isSafeInteger(now)) throw new TypeError('Invalid AG-UI timestamp');

  const timestamp = now;
  const messageId = runId + '-message';
  return [
    { type: 'RUN_STARTED', threadId, runId, protocolVersion: '1.0', timestamp },
    { type: 'TEXT_MESSAGE_START', messageId, role: 'assistant', timestamp },
    { type: 'TEXT_MESSAGE_CONTENT', messageId, delta: message, timestamp },
    { type: 'TEXT_MESSAGE_END', messageId, timestamp },
    { type: 'RUN_FINISHED', threadId, runId, timestamp },
  ];
}

export function encodeAgUiSse(events) {
  if (!Array.isArray(events) || events.length > 256) {
    throw new TypeError('Invalid AG-UI event list');
  }
  return events.map((event) => {
    if (!event || typeof event !== 'object' || Array.isArray(event) ||
        !EVENT_TYPES.has(event.type)) {
      throw new TypeError('Invalid AG-UI event');
    }
    let serialized;
    try { serialized = JSON.stringify(event); }
    catch { throw new TypeError('Invalid AG-UI event payload'); }
    if (typeof serialized !== 'string' || serialized.length > MAX_EVENT_BYTES) {
      throw new TypeError('AG-UI event exceeds size limit');
    }
    return 'data: ' + serialized + '\n\n';
  }).join('');
}

export function createAgUiSseResponse(events, status = 200) {
  return new Response(encodeAgUiSse(events), {
    status,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
