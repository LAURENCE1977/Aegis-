const ALLOWED_MODALITIES = Object.freeze(['voice', 'touch', 'gaze', 'switch', 'eeg']);
const ALLOWED_INTENTS = Object.freeze(['select', 'navigate', 'confirm', 'cancel', 'pause', 'focus', 'unknown']);
const EEG_CONFIDENCE_CEILING = 0.65;
const MAX_OBSERVATION_AGE_MS = 10_000;
const MAX_FUTURE_SKEW_MS = 1_000;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normaliseIntentObservation(input) {
  if (!isRecord(input)) throw new TypeError('Intent observation must be an object.');
  const allowed = new Set([
    'modality', 'intent', 'confidence', 'signalQuality', 'observedAt',
    'consentGranted', 'sampleWindowMs', 'channelCount',
  ]);
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new TypeError('Unexpected intent observation fields.');
  }
  if (!ALLOWED_MODALITIES.includes(input.modality)) {
    throw new TypeError('Unsupported intent observation modality.');
  }
  if (!ALLOWED_INTENTS.includes(input.intent)) {
    throw new TypeError('Unsupported intent label.');
  }
  if (input.consentGranted !== true) {
    throw new TypeError('Explicit consent is required for every captured observation.');
  }
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    throw new TypeError('Confidence must be a finite number between zero and one.');
  }
  if (!Number.isFinite(input.signalQuality) || input.signalQuality < 0 || input.signalQuality > 1) {
    throw new TypeError('Signal quality must be a finite number between zero and one.');
  }
  if (typeof input.observedAt !== 'string' || !Number.isFinite(Date.parse(input.observedAt))) {
    throw new TypeError('A valid observation timestamp is required.');
  }

  const result = {
    modality: input.modality,
    intent: input.intent,
    confidence: input.modality === 'eeg'
      ? Math.min(input.confidence, EEG_CONFIDENCE_CEILING)
      : input.confidence,
    signalQuality: input.signalQuality,
    observedAt: new Date(input.observedAt).toISOString(),
    authority: 'proposal-only',
  };

  if (input.modality === 'eeg') {
    if (!Number.isInteger(input.sampleWindowMs) || input.sampleWindowMs < 250 || input.sampleWindowMs > 5000) {
      throw new TypeError('EEG sample window must be between 250 and 5000 milliseconds.');
    }
    if (!Number.isInteger(input.channelCount) || input.channelCount < 1 || input.channelCount > 128) {
      throw new TypeError('EEG channel count must be between 1 and 128.');
    }
    result.sampleWindowMs = input.sampleWindowMs;
    result.channelCount = input.channelCount;
  } else if (input.sampleWindowMs !== undefined || input.channelCount !== undefined) {
    throw new TypeError('EEG sampling metadata is only valid for EEG observations.');
  }

  return Object.freeze(result);
}

export function createIntentProposal(observations, options = {}) {
  if (!Array.isArray(observations) || observations.length < 1 || observations.length > 8) {
    throw new TypeError('Provide between one and eight intent observations.');
  }
  const nowValue = options.now ?? new Date().toISOString();
  const now = typeof nowValue === 'number' ? nowValue : Date.parse(nowValue);
  if (!Number.isFinite(now)) throw new TypeError('A valid proposal timestamp is required.');
  const maxAgeMs = options.maxAgeMs ?? MAX_OBSERVATION_AGE_MS;
  const minConfidence = options.minConfidence ?? 0.75;
  if (!Number.isInteger(maxAgeMs) || maxAgeMs < 100 || maxAgeMs > 60_000) {
    throw new TypeError('Observation freshness window must be between 100 and 60000 milliseconds.');
  }
  if (!Number.isFinite(minConfidence) || minConfidence < 0.5 || minConfidence > 1) {
    throw new TypeError('Confidence threshold must be between 0.5 and one.');
  }

  const normalised = observations.map(normaliseIntentObservation);
  for (const observation of normalised) {
    const age = now - Date.parse(observation.observedAt);
    if (age < -MAX_FUTURE_SKEW_MS) throw new TypeError('Future-dated observations are not accepted.');
    if (age > maxAgeMs) throw new TypeError('Stale observations are not accepted.');
  }

  const intents = new Set(normalised.map((item) => item.intent));
  const consensus = intents.size === 1 && !intents.has('unknown');
  const totalWeight = normalised.reduce((sum, item) => sum + Math.max(item.signalQuality, 0.01), 0);
  const confidence = normalised.reduce(
    (sum, item) => sum + item.confidence * Math.max(item.signalQuality, 0.01), 0,
  ) / totalWeight;
  const candidate = consensus && confidence >= minConfidence;

  return Object.freeze({
    status: candidate ? 'candidate' : 'ambiguous',
    intent: candidate ? normalised[0].intent : 'unknown',
    confidence: Number(confidence.toFixed(4)),
    modalities: [...new Set(normalised.map((item) => item.modality))],
    observedAt: new Date(now).toISOString(),
    requiresExplicitConfirmation: true,
    authorised: false,
    execution: 'none',
    authority: 'proposal-only',
  });
}

export const INTENT_MODALITIES = ALLOWED_MODALITIES;
export const INTENT_LABELS = ALLOWED_INTENTS;
