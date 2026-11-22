const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_SESSION_LIFETIME_MS = 15 * 60 * 1000;
const MAX_TRANSCRIPT_LENGTH = 4000;
const LOCALE = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;

const EVENT_TYPES = new Set([
  'capture.started',
  'capture.stopped',
  'transcript.partial',
  'transcript.final',
  'thinking.started',
  'speech.started',
  'interrupt',
  'turn.completed',
  'disconnect',
  'close',
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return isRecord(value) && Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key));
}

function validId(value, label) {
  if (typeof value !== 'string' || !SESSION_ID.test(value)) {
    throw new TypeError('Invalid voice session ' + label + '.');
  }
  return value;
}

function validTimestamp(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError('Invalid voice session ' + label + ' timestamp.');
  }
  return value;
}

function validatePayload(type, payload) {
  if (!isRecord(payload)) throw new TypeError('Invalid voice event payload.');

  switch (type) {
    case 'capture.started':
      if (!exactKeys(payload, ['source']) || payload.source !== 'push-to-talk') {
        throw new TypeError('Invalid voice event payload.');
      }
      break;
    case 'capture.stopped':
      if (!exactKeys(payload, ['reason']) ||
          !['user-stop', 'permission-revoked', 'silence-timeout', 'error'].includes(payload.reason)) {
        throw new TypeError('Invalid voice event payload.');
      }
      break;
    case 'transcript.partial':
    case 'transcript.final':
      if (!exactKeys(payload, ['text', 'confidence', 'locale']) ||
          typeof payload.text !== 'string' || !payload.text.trim() ||
          payload.text.length > MAX_TRANSCRIPT_LENGTH ||
          /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(payload.text)) {
        throw new TypeError('Invalid voice transcript.');
      }
      if (typeof payload.confidence !== 'number' || !Number.isFinite(payload.confidence) ||
          payload.confidence < 0 || payload.confidence > 1) {
        throw new TypeError('Invalid voice transcript confidence.');
      }
      if (typeof payload.locale !== 'string' || !LOCALE.test(payload.locale)) {
        throw new TypeError('Invalid voice transcript locale.');
      }
      break;
    case 'thinking.started':
    case 'disconnect':
    case 'close':
      if (!exactKeys(payload, [])) throw new TypeError('Invalid voice event payload.');
      break;
    case 'speech.started':
      if (!exactKeys(payload, ['responseId'])) {
        throw new TypeError('Invalid voice event payload.');
      }
      validId(payload.responseId, 'response identifier');
      break;
    case 'interrupt':
      if (!exactKeys(payload, ['source']) || payload.source !== 'user') {
        throw new TypeError('Invalid voice event payload.');
      }
      break;
    case 'turn.completed':
      if (!exactKeys(payload, ['outcome']) ||
          !['answered', 'cancelled', 'failed'].includes(payload.outcome)) {
        throw new TypeError('Invalid voice event payload.');
      }
      break;
    default:
      throw new TypeError('Invalid voice event type.');
  }
  return payload;
}

/**
 * Creates an ephemeral browser voice-session state record.
 * Audio and transcript content are event data only and are never copied into
 * this state object. Persistence is deliberately outside this contract.
 */
export function createVoiceSession(input) {
  const keys = ['sessionId', 'principalId', 'clientId', 'transport', 'createdAt', 'expiresAt'];
  if (!exactKeys(input, keys)) throw new TypeError('Invalid voice session fields.');
  const sessionId = validId(input.sessionId, 'session identifier');
  const principalId = validId(input.principalId, 'principal identifier');
  const clientId = validId(input.clientId, 'client identifier');
  if (input.transport !== 'browser') throw new TypeError('Invalid voice session transport.');
  const createdAt = validTimestamp(input.createdAt, 'creation');
  const expiresAt = validTimestamp(input.expiresAt, 'expiry');
  const lifetime = expiresAt - createdAt;
  if (lifetime <= 0 || lifetime > MAX_SESSION_LIFETIME_MS) {
    throw new TypeError('Invalid voice session lifetime.');
  }
  return {
    schemaVersion: 1,
    sessionId,
    principalId,
    clientId,
    transport: input.transport,
    createdAt,
    expiresAt,
    status: 'idle',
    captureActive: false,
    lastSequence: 0,
    lastOccurredAt: createdAt,
  };
}

/** Validate a versioned, bounded event before it enters the state machine. */
export function validateVoiceSessionEvent(event) {
  if (!exactKeys(event, ['schemaVersion', 'sessionId', 'sequence', 'type', 'occurredAt', 'payload']) ||
      event.schemaVersion !== 1) {
    throw new TypeError('Invalid voice event envelope.');
  }
  validId(event.sessionId, 'event session identifier');
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 1) {
    throw new TypeError('Invalid voice event sequence.');
  }
  if (!EVENT_TYPES.has(event.type)) throw new TypeError('Invalid voice event type.');
  validTimestamp(event.occurredAt, 'event');
  validatePayload(event.type, event.payload);
  return {
    schemaVersion: 1,
    sessionId: event.sessionId,
    sequence: event.sequence,
    type: event.type,
    occurredAt: event.occurredAt,
    payload: structuredClone(event.payload),
  };
}

function denied(session, reasonCode) {
  return { session, allowed: false, reasonCode };
}

/**
 * Apply one ordered event to an immutable session snapshot.
 * The caller must supply the current owner/client binding and current Sentinel
 * consent result; neither is inferred from event data.
 */
export function applyVoiceSessionEvent(session, inputEvent, context = {}) {
  if (!isRecord(session) || session.schemaVersion !== 1 ||
      !isRecord(context)) {
    return denied(session, 'INVALID_CONTEXT');
  }

  let event;
  try {
    event = validateVoiceSessionEvent(inputEvent);
  } catch {
    return denied(session, 'INVALID_EVENT');
  }

  if (event.sessionId !== session.sessionId) return denied(session, 'SESSION_MISMATCH');
  if (session.status === 'closed') return denied(session, 'SESSION_CLOSED');
  const now = Number.isSafeInteger(context.now) ? context.now : NaN;
  if (!Number.isSafeInteger(now) || now < 0) return denied(session, 'INVALID_CONTEXT');
  if (now >= session.expiresAt) return denied(session, 'SESSION_EXPIRED');
  if (event.sequence !== session.lastSequence + 1) {
    return denied(session, 'SEQUENCE_MISMATCH');
  }
  if (event.occurredAt < session.lastOccurredAt) {
    return denied(session, 'TIMESTAMP_REGRESSION');
  }

  const next = { ...session, lastSequence: event.sequence, lastOccurredAt: event.occurredAt };
  const deny = (reasonCode) => denied(session, reasonCode);

  switch (event.type) {
    case 'capture.started':
      if (session.status !== 'idle') return deny('INVALID_TRANSITION');
      if (context.userInitiated !== true) return deny('USER_ACTION_REQUIRED');
      if (context.captureGranted !== true) return deny('CAPTURE_CONSENT_REQUIRED');
      next.status = 'listening';
      next.captureActive = true;
      break;
    case 'capture.stopped':
      if (session.status !== 'listening' || session.captureActive !== true) {
        return deny('CAPTURE_NOT_ACTIVE');
      }
      next.status = 'thinking';
      next.captureActive = false;
      break;
    case 'transcript.partial':
    case 'transcript.final':
      if (session.status !== 'listening' || session.captureActive !== true) {
        return deny('CAPTURE_NOT_ACTIVE');
      }
      // Deliberately do not persist transcript text, audio, or confidence.
      break;
    case 'thinking.started':
      if (!['idle', 'interrupted'].includes(session.status)) return deny('INVALID_TRANSITION');
      next.status = 'thinking';
      next.captureActive = false;
      break;
    case 'speech.started':
      if (session.status !== 'thinking') return deny('INVALID_TRANSITION');
      next.status = 'speaking';
      next.captureActive = false;
      break;
    case 'interrupt':
      if (session.status !== 'speaking') return deny('INVALID_TRANSITION');
      next.status = 'interrupted';
      next.captureActive = false;
      break;
    case 'turn.completed':
      if (!['thinking', 'speaking', 'interrupted'].includes(session.status)) {
        return deny('INVALID_TRANSITION');
      }
      next.status = 'idle';
      next.captureActive = false;
      break;
    case 'disconnect':
      if (session.status === 'disconnected') return deny('INVALID_TRANSITION');
      next.status = 'disconnected';
      next.captureActive = false;
      break;
    case 'close':
      next.status = 'closed';
      next.captureActive = false;
      break;
    default:
      return deny('INVALID_EVENT');
  }

  return { session: next, allowed: true, reasonCode: 'EVENT_APPLIED' };
}
