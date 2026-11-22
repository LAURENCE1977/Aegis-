import test from 'node:test';
import assert from 'node:assert/strict';
import { createHealthObservation, formatHealthVisionReport, isHealthPreviewRequestCurrent } from '../health-vision-core.mjs';

const now = '2026-11-22T20:00:00.000Z';
const valid = {
  kind: 'skin',
  bodyArea: 'left forearm',
  observedOn: '2026-11-21',
  description: 'A small red patch noticed after gardening.',
  symptoms: 'Mild itching',
  changes: 'Looks slightly larger today',
};

test('creates a bounded observation without retaining image or arbitrary input fields', () => {
  const observation = createHealthObservation({ ...valid, imageData: 'private-image-bytes', secret: 'ignored' }, now);
  assert.equal(observation.kind, 'skin');
  assert.equal(observation.bodyArea, 'left forearm');
  assert.equal(observation.recordedAt, now);
  assert.equal('imageData' in observation, false);
  assert.equal('secret' in observation, false);
  assert.deepEqual(Object.keys(observation).sort(), [
    'bodyArea', 'changes', 'description', 'id', 'kind', 'observedOn', 'recordedAt', 'symptoms',
  ].sort());
});

test('rejects missing, malformed and overlong observation content', () => {
  assert.throws(() => createHealthObservation({}, now), /kind/i);
  assert.throws(() => createHealthObservation({ ...valid, description: '' }, now), /description/i);
  assert.throws(() => createHealthObservation({ ...valid, kind: 'diagnosis' }, now), /kind/i);
  assert.throws(() => createHealthObservation({ ...valid, description: 'x'.repeat(2001) }, now), /description/i);
  assert.throws(() => createHealthObservation({ ...valid, observedOn: 'not-a-date' }, now), /date/i);
});

test('rejects future observation dates and invalid clock values', () => {
  assert.throws(() => createHealthObservation({ ...valid, observedOn: '2026-11-23' }, now), /future/i);
  assert.throws(() => createHealthObservation(valid, 'not-a-date'), /clock/i);
});

test('report is plain text, includes safety boundary and never includes image payloads', () => {
  const observation = createHealthObservation({ ...valid, imageData: 'DO_NOT_EXPORT_IMAGE' }, now);
  const report = formatHealthVisionReport([observation], now);
  assert.match(report, /AEGIS Health Vision/);
  assert.match(report, /not a diagnosis/i);
  assert.match(report, /left forearm/);
  assert.doesNotMatch(report, /DO_NOT_EXPORT_IMAGE/);
  assert.doesNotMatch(report, /<script>/);
});

test('report enforces bounded entry count and rejects malformed records', () => {
  const observation = createHealthObservation(valid, now);
  assert.throws(() => formatHealthVisionReport(Array(21).fill(observation), now), /20/);
  assert.throws(() => formatHealthVisionReport([{ ...observation, description: null }], now), /invalid/i);
});


test('invalidates an asynchronous photo preview after clear or session close', () => {
  assert.equal(isHealthPreviewRequestCurrent(4, 4, true), true);
  assert.equal(isHealthPreviewRequestCurrent(3, 4, true), false);
  assert.equal(isHealthPreviewRequestCurrent(4, 4, false), false);
});
