const EVENT_TYPES = new Set([
  'TEXT_MESSAGE_START','TEXT_MESSAGE_CONTENT','TEXT_MESSAGE_END',
  'RUN_STARTED','RUN_FINISHED','RUN_ERROR',
  'TOOL_CALL_START','TOOL_CALL_ARGS','TOOL_CALL_END','TOOL_CALL_RESULT',
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

export function createTextRunStartEvents({ threadId, runId, now = Date.now() }) {
  requireIdentifier(threadId, 'thread ID');
  requireIdentifier(runId, 'run ID');
  if (!Number.isSafeInteger(now)) throw new TypeError('Invalid AG-UI timestamp');
  return [
    { type: 'RUN_STARTED', threadId, runId, protocolVersion: '1.0', timestamp: now },
    { type: 'TEXT_MESSAGE_START', messageId: runId, role: 'assistant', timestamp: now },
  ];
}

export function createTextRunContentEvent({ runId, delta, now = Date.now() }) {
  requireIdentifier(runId, 'run ID');
  if (typeof delta !== 'string' || delta.length > MAX_MESSAGE) {
    throw new TypeError('Invalid AG-UI message delta');
  }
  if (!Number.isSafeInteger(now)) throw new TypeError('Invalid AG-UI timestamp');
  return { type: 'TEXT_MESSAGE_CONTENT', messageId: runId, delta, timestamp: now };
}

export function createTextRunFinishEvents({ threadId, runId, now = Date.now(), outcome }) {
  requireIdentifier(threadId, 'thread ID');
  requireIdentifier(runId, 'run ID');
  if (!Number.isSafeInteger(now)) throw new TypeError('Invalid AG-UI timestamp');
  if (outcome !== undefined && outcome !== 'cancelled') throw new TypeError('Invalid AG-UI run outcome');
  return [
    { type: 'TEXT_MESSAGE_END', messageId: runId, timestamp: now },
    { type: 'RUN_FINISHED', threadId, runId, timestamp: now, ...(outcome ? { outcome } : {}) },
  ];
}

export function createTextRunErrorEvent({ message, code = 'AGENT_STREAM_ERROR', now = Date.now() }) {
  if (typeof message !== 'string' || !message.trim() || message.length > 512) {
    throw new TypeError('Invalid AG-UI error message');
  }
  if (typeof code !== 'string' || !/^[A-Z0-9_]{1,64}$/.test(code)) {
    throw new TypeError('Invalid AG-UI error code');
  }
  if (!Number.isSafeInteger(now)) throw new TypeError('Invalid AG-UI timestamp');
  return { type: 'RUN_ERROR', message, code, timestamp: now };
}

export function createTextRunEvents({ threadId, runId, message, now = Date.now() }) {
  if (typeof message !== 'string' || message.length > MAX_MESSAGE) {
    throw new TypeError('Invalid AG-UI message');
  }
  return [
    ...createTextRunStartEvents({ threadId, runId, now }),
    createTextRunContentEvent({ runId, delta: message, now }),
    ...createTextRunFinishEvents({ threadId, runId, now }),
  ];
}

export function createToolCallStartEvents({ toolCallId, toolCallName, argumentsText, now = Date.now() }) {
  requireIdentifier(toolCallId, 'tool call ID');
  if (typeof toolCallName !== 'string' || !/^[A-Za-z0-9_.-]{1,64}$/.test(toolCallName)) {
    throw new TypeError('Invalid AG-UI tool name');
  }
  if (typeof argumentsText !== 'string' || argumentsText.length > 4096) {
    throw new TypeError('Invalid AG-UI tool arguments');
  }
  if (!Number.isSafeInteger(now)) throw new TypeError('Invalid AG-UI timestamp');
  return [
    { type: 'TOOL_CALL_START', toolCallId, toolCallName, timestamp: now },
    { type: 'TOOL_CALL_ARGS', toolCallId, delta: argumentsText, timestamp: now },
    { type: 'TOOL_CALL_END', toolCallId, timestamp: now },
  ];
}

export function createToolCallResultEvent({ messageId, toolCallId, content, now = Date.now() }) {
  requireIdentifier(messageId, 'message ID');
  requireIdentifier(toolCallId, 'tool call ID');
  if (typeof content !== 'string' || content.length > 4000) {
    throw new TypeError('Invalid AG-UI tool result');
  }
  if (!Number.isSafeInteger(now)) throw new TypeError('Invalid AG-UI timestamp');
  return { type: 'TOOL_CALL_RESULT', messageId, toolCallId, content, timestamp: now };
}

export function encodeAgUiSse(events) {
  if (!Array.isArray(events) || events.length > 256) {
    throw new TypeError('Invalid AG-UI event list');
  }
  return events.map(event => {
    if (!event || typeof event !== 'object' || Array.isArray(event) || !EVENT_TYPES.has(event.type)) {
      throw new TypeError('Invalid AG-UI event');
    }
    let valid = false;
    switch (event.type) {
      case 'RUN_STARTED':
        valid = typeof event.threadId === 'string' && typeof event.runId === 'string' && event.protocolVersion === '1.0';
        break;
      case 'RUN_FINISHED':
        valid = typeof event.threadId === 'string' && typeof event.runId === 'string' &&
          (event.outcome === undefined || event.outcome === 'cancelled' ||
            (event.outcome && typeof event.outcome === 'object'));
        break;
      case 'TEXT_MESSAGE_START':
        valid = typeof event.messageId === 'string' && (event.role === undefined || event.role === 'assistant');
        break;
      case 'TEXT_MESSAGE_CONTENT':
        valid = typeof event.messageId === 'string' && typeof event.delta === 'string' && event.delta.length <= MAX_MESSAGE;
        break;
      case 'TEXT_MESSAGE_END':
        valid = typeof event.messageId === 'string';
        break;
      case 'RUN_ERROR':
        valid = typeof event.message === 'string' && event.message.length <= 512 &&
          (event.code === undefined || typeof event.code === 'string');
        break;
      case 'TOOL_CALL_START':
        valid = typeof event.toolCallId === 'string' && typeof event.toolCallName === 'string' &&
          /^[A-Za-z0-9_.-]{1,64}$/.test(event.toolCallName);
        break;
      case 'TOOL_CALL_ARGS':
        valid = typeof event.toolCallId === 'string' && typeof event.delta === 'string' && event.delta.length <= 4096;
        break;
      case 'TOOL_CALL_END':
        valid = typeof event.toolCallId === 'string';
        break;
      case 'TOOL_CALL_RESULT':
        valid = typeof event.messageId === 'string' && typeof event.toolCallId === 'string' &&
          typeof event.content === 'string' && event.content.length <= 4000;
        break;
    }
    if (!valid) throw new TypeError('Invalid AG-UI event payload');
    let serialized;
    try { serialized = JSON.stringify(event); }
    catch { throw new TypeError('Invalid AG-UI event payload'); }
    if (typeof serialized !== 'string' || new TextEncoder().encode(serialized).byteLength > MAX_EVENT_BYTES) {
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
