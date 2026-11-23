import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliseIntentObservation,
  createIntentProposal,
} from '../workers/runtime/intent-engine.mjs';

const now = '2026-11-23T23:30:00.000Z';

function observation(overrides = {}) {
  return {
    modality: 'voice',
    intent: 'select',
    confidence: 0.92,
    signalQuality: 0.9,
    observedAt: now,
    consentGranted: true,
    ...overrides,
  };
}

test('normalises a consented voice observation into a bounded intent event', () => {
  const result = normaliseIntentObservation(observation());
  assert.equal(result.modality, 'voice');
  assert.equal(result.intent, 'select');
  assert.equal(result.confidence, 0.92);
  assert.equal(result.authority, 'proposal-only');
  assert.equal('rawSignal' in result, false);
});

test('rejects observations without explicit capture consent', () => {
  assert.throws(() => normaliseIntentObservation(observation({ consentGranted: false })), /consent/i);
  assert.throws(() => normaliseIntentObservation(observation({ consentGranted: undefined })), /consent/i);
});

test('rejects unknown modalities, intents, extra fields and invalid confidence values', () => {
  assert.throws(() => normaliseIntentObservation(observation({ modality: 'implant' })), /modality/i);
  assert.throws(() => normaliseIntentObservation(observation({ intent: 'send-money' })), /intent/i);
  assert.throws(() => normaliseIntentObservation({ ...observation(), rawSignal: [1, 2, 3] }), /unexpected/i);
  assert.throws(() => normaliseIntentObservation(observation({ confidence: 1.2 })), /confidence/i);
});

test('EEG observations require a bounded sample window and channel count', () => {
  const eeg = observation({ modality: 'eeg', sampleWindowMs: 1000, channelCount: 4 });
  const result = normaliseIntentObservation(eeg);
  assert.equal(result.modality, 'eeg');
  assert.equal(result.sampleWindowMs, 1000);
  assert.equal(result.channelCount, 4);
  assert.throws(() => normaliseIntentObservation(observation({ modality: 'eeg' })), /sample window/i);
  assert.throws(() => normaliseIntentObservation(observation({ modality: 'eeg', sampleWindowMs: 1000, channelCount: 0 })), /channel/i);
});

test('EEG confidence is capped because non-invasive decoding is uncertain', () => {
  const result = normaliseIntentObservation(observation({
    modality: 'eeg', sampleWindowMs: 1000, channelCount: 4, confidence: 0.99,
  }));
  assert.equal(result.confidence, 0.65);
});

test('creates a proposal from fresh agreeing modalities but never authorises execution', () => {
  const proposal = createIntentProposal([
    observation({ modality: 'voice', confidence: 0.9 }),
    observation({ modality: 'touch', confidence: 0.95 }),
  ], { now });
  assert.equal(proposal.status, 'candidate');
  assert.equal(proposal.intent, 'select');
  assert.equal(proposal.requiresExplicitConfirmation, true);
  assert.equal(proposal.authorised, false);
  assert.equal(proposal.execution, 'none');
});

test('marks conflicting or low-confidence observations as ambiguous', () => {
  const conflict = createIntentProposal([
    observation({ modality: 'voice', intent: 'select', confidence: 0.95 }),
    observation({ modality: 'touch', intent: 'cancel', confidence: 0.9 }),
  ], { now });
  assert.equal(conflict.status, 'ambiguous');
  assert.equal(conflict.intent, 'unknown');
  const weak = createIntentProposal([observation({ confidence: 0.4 })], { now });
  assert.equal(weak.status, 'ambiguous');
});

test('rejects stale and future-dated observations rather than guessing intent', () => {
  assert.throws(() => createIntentProposal([
    observation({ observedAt: '2026-11-23T23:00:00.000Z' }),
  ], { now }), /stale/i);
  assert.throws(() => createIntentProposal([
    observation({ observedAt: '2026-11-23T23:31:00.000Z' }),
  ], { now }), /future/i);
});

test('rejects empty observation batches and invalid thresholds', () => {
  assert.throws(() => createIntentProposal([], { now }), /observation/i);
  assert.throws(() => createIntentProposal([observation()], { now, minConfidence: 2 }), /threshold/i);
});
