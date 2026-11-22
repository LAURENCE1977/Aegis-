import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVoiceSession,
  validateVoiceSessionEvent,
  applyVoiceSessionEvent,
} from '../functions/lib/companion-voice-session.mjs';

const now = 1795300000000;
const session = () => createVoiceSession({
  sessionId: 'voice-session-01',
  principalId: 'owner-01',
  clientId: 'browser-01',
  transport: 'browser',
  createdAt: now,
  expiresAt: now + 5 * 60 * 1000,
});

const event = (type, sequence, payload = {}, occurredAt = now + sequence) => ({
  schemaVersion: 1,
  sessionId: 'voice-session-01',
  sequence,
  type,
  occurredAt,
  payload,
});

test('voice sessions are short-lived, owner-bound and start with capture disabled', () => {
  const value = session();
  assert.equal(value.schemaVersion, 1);
  assert.equal(value.principalId, 'owner-01');
  assert.equal(value.clientId, 'browser-01');
  assert.equal(value.status, 'idle');
  assert.equal(value.captureActive, false);
  assert.equal(value.lastSequence, 0);
  assert.equal(value.expiresAt, now + 5 * 60 * 1000);
});

test('voice session creation rejects malformed identities, transports and excessive lifetimes', () => {
  assert.throws(() => createVoiceSession({
    sessionId: '../bad', principalId: 'owner-01', clientId: 'browser-01',
    transport: 'browser', createdAt: now, expiresAt: now + 1000,
  }), /session identifier/);
  assert.throws(() => createVoiceSession({
    sessionId: 'voice-session-01', principalId: '', clientId: 'browser-01',
    transport: 'browser', createdAt: now, expiresAt: now + 1000,
  }), /principal/);
  assert.throws(() => createVoiceSession({
    sessionId: 'voice-session-01', principalId: 'owner-01', clientId: 'browser-01',
    transport: 'cloud', createdAt: now, expiresAt: now + 1000,
  }), /transport/);
  assert.throws(() => createVoiceSession({
    sessionId: 'voice-session-01', principalId: 'owner-01', clientId: 'browser-01',
    transport: 'browser', createdAt: now, expiresAt: now + 16 * 60 * 1000,
  }), /lifetime/);
});

test('voice event envelopes reject unknown fields, malformed payloads and invalid sequence numbers', () => {
  const valid = event('capture.started', 1, { source: 'push-to-talk' });
  assert.equal(validateVoiceSessionEvent(valid).type, 'capture.started');
  assert.throws(() => validateVoiceSessionEvent({ ...valid, extra: true }), /event envelope/);
  assert.throws(() => validateVoiceSessionEvent({ ...valid, sequence: 0 }), /sequence/);
  assert.throws(() => validateVoiceSessionEvent({ ...valid, payload: { source: 'push-to-talk', token: 'secret' } }), /payload/);
  assert.throws(() => validateVoiceSessionEvent({ ...valid, type: 'execute.shell' }), /event type/);
});

test('capture cannot start without a user gesture and a current Sentinel capture grant', () => {
  const initial = session();
  const start = event('capture.started', 1, { source: 'push-to-talk' });
  assert.deepEqual(applyVoiceSessionEvent(initial, start, {
    userInitiated: false, captureGranted: true, now,
  }), { session: initial, allowed: false, reasonCode: 'USER_ACTION_REQUIRED' });
  assert.deepEqual(applyVoiceSessionEvent(initial, start, {
    userInitiated: true, captureGranted: false, now,
  }), { session: initial, allowed: false, reasonCode: 'CAPTURE_CONSENT_REQUIRED' });
  const accepted = applyVoiceSessionEvent(initial, start, {
    userInitiated: true, captureGranted: true, now,
  });
  assert.equal(accepted.allowed, true);
  assert.equal(accepted.session.status, 'listening');
  assert.equal(accepted.session.captureActive, true);
});

test('transcript events are accepted only during active capture and are not persisted in session state', () => {
  const initial = session();
  const partial = event('transcript.partial', 1, {
    text: 'Hello AEGIS', confidence: 0.92, locale: 'en-GB',
  });
  assert.equal(applyVoiceSessionEvent(initial, partial, { now }).reasonCode, 'CAPTURE_NOT_ACTIVE');
  const listening = applyVoiceSessionEvent(initial,
    event('capture.started', 1, { source: 'push-to-talk' }),
    { userInitiated: true, captureGranted: true, now }).session;
  const result = applyVoiceSessionEvent(listening, event('transcript.final', 2, {
    text: 'Hello AEGIS', confidence: 0.98, locale: 'en-GB',
  }), { now });
  assert.equal(result.allowed, true);
  assert.equal(result.session.status, 'listening');
  assert.equal(Object.hasOwn(result.session, 'transcript'), false);
  assert.equal(Object.hasOwn(result.session, 'audio'), false);
});

test('capture stop closes the microphone state before the turn can complete', () => {
  const initial = session();
  const listening = applyVoiceSessionEvent(initial,
    event('capture.started', 1, { source: 'push-to-talk' }),
    { userInitiated: true, captureGranted: true, now }).session;
  const stopped = applyVoiceSessionEvent(listening,
    event('capture.stopped', 2, { reason: 'user-stop' }), { now });
  assert.equal(stopped.allowed, true);
  assert.equal(stopped.session.status, 'thinking');
  assert.equal(stopped.session.captureActive, false);
  const completed = applyVoiceSessionEvent(stopped.session,
    event('turn.completed', 3, { outcome: 'answered' }), { now });
  assert.equal(completed.session.status, 'idle');
});

test('assistant speech can be interrupted and interruption never restarts capture implicitly', () => {
  let current = session();
  current = applyVoiceSessionEvent(current,
    event('thinking.started', 1), { now }).session;
  current = applyVoiceSessionEvent(current,
    event('speech.started', 2, { responseId: 'response-01' }), { now }).session;
  assert.equal(current.status, 'speaking');
  const interrupted = applyVoiceSessionEvent(current,
    event('interrupt', 3, { source: 'user' }), { now });
  assert.equal(interrupted.session.status, 'interrupted');
  assert.equal(interrupted.session.captureActive, false);
});

test('duplicate, skipped and cross-session events are rejected without changing state', () => {
  const initial = session();
  const first = event('capture.started', 1, { source: 'push-to-talk' });
  const listening = applyVoiceSessionEvent(initial, first, {
    userInitiated: true, captureGranted: true, now,
  }).session;
  assert.equal(applyVoiceSessionEvent(listening, first, { now }).reasonCode, 'SEQUENCE_MISMATCH');
  assert.equal(applyVoiceSessionEvent(listening, event('transcript.partial', 3, {
    text: 'out of order', confidence: 0.8, locale: 'en-GB',
  }), { now }).reasonCode, 'SEQUENCE_MISMATCH');
  assert.equal(applyVoiceSessionEvent(listening, {
    ...event('capture.stopped', 2, { reason: 'user-stop' }), sessionId: 'another-session',
  }, { now }).reasonCode, 'SESSION_MISMATCH');
});

test('voice sessions reject expired sessions and out-of-order timestamps', () => {
  const initial = session();
  assert.equal(applyVoiceSessionEvent(initial,
    event('capture.started', 1, { source: 'push-to-talk' }), {
      userInitiated: true, captureGranted: true, now: initial.expiresAt,
    }).reasonCode, 'SESSION_EXPIRED');
  const started = applyVoiceSessionEvent(initial,
    event('thinking.started', 1, {}, now + 100), { now }).session;
  assert.equal(applyVoiceSessionEvent(started,
    event('speech.started', 2, { responseId: 'response-01' }, now + 50), { now }).reasonCode,
  'TIMESTAMP_REGRESSION');
});

test('disconnect and close stop capture and make the session terminal', () => {
  const initial = session();
  const listening = applyVoiceSessionEvent(initial,
    event('capture.started', 1, { source: 'push-to-talk' }),
    { userInitiated: true, captureGranted: true, now }).session;
  const disconnected = applyVoiceSessionEvent(listening,
    event('disconnect', 2), { now });
  assert.equal(disconnected.session.status, 'disconnected');
  assert.equal(disconnected.session.captureActive, false);
  const closed = applyVoiceSessionEvent(disconnected.session,
    event('close', 3), { now });
  assert.equal(closed.session.status, 'closed');
  assert.equal(applyVoiceSessionEvent(closed.session,
    event('capture.started', 4, { source: 'push-to-talk' }), {
      userInitiated: true, captureGranted: true, now,
    }).reasonCode, 'SESSION_CLOSED');
});

test('transcript text and confidence are bounded and validated', () => {
  assert.throws(() => validateVoiceSessionEvent(event('transcript.final', 1, {
    text: 'x'.repeat(4001), confidence: 0.9, locale: 'en-GB',
  })), /transcript/);
  assert.throws(() => validateVoiceSessionEvent(event('transcript.partial', 1, {
    text: 'hello', confidence: 1.1, locale: 'en-GB',
  })), /confidence/);
  assert.throws(() => validateVoiceSessionEvent(event('transcript.final', 1, {
    text: 'hello', confidence: 0.9, locale: 'English',
  })), /locale/);
});
