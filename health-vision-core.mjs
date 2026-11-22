const KINDS = new Set(['skin', 'wound', 'symptom', 'general']);
const MAX_DESCRIPTION = 2000;
const MAX_OPTIONAL_TEXT = 1000;
const MAX_ENTRIES = 20;

function cleanText(value, field, max, required = false) {
  if (typeof value !== 'string') throw new TypeError(field + ' must be text');
  const cleaned = value.trim();
  if (required && !cleaned) throw new TypeError(field + ' is required');
  if (cleaned.length > max) throw new RangeError(field + ' is too long');
  return cleaned;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validClock(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

/**
 * Creates a text-only observation record. Image bytes and unknown fields are
 * deliberately ignored; this module has no storage, network or diagnostic code.
 */
export function createHealthObservation(input, now = new Date().toISOString()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Observation must be an object');
  }
  if (!validClock(now)) throw new TypeError('Invalid assessment clock');
  if (!KINDS.has(input.kind)) throw new TypeError('Invalid observation kind');
  const bodyArea = cleanText(input.bodyArea ?? '', 'Body area', 120);
  const observedOn = input.observedOn;
  if (!validDate(observedOn)) throw new TypeError('Invalid observation date');
  if (observedOn > now.slice(0, 10)) throw new RangeError('Observation date cannot be in the future');
  const description = cleanText(input.description, 'Description', MAX_DESCRIPTION, true);
  const symptoms = cleanText(input.symptoms ?? '', 'Symptoms', MAX_OPTIONAL_TEXT);
  const changes = cleanText(input.changes ?? '', 'Changes over time', MAX_OPTIONAL_TEXT);
  return Object.freeze({
    id: globalThis.crypto?.randomUUID?.() ?? 'observation-' + Math.random().toString(36).slice(2),
    kind: input.kind,
    bodyArea,
    observedOn,
    description,
    symptoms,
    changes,
    recordedAt: now,
  });
}

export function formatHealthVisionReport(observations, generatedAt = new Date().toISOString()) {
  if (!Array.isArray(observations) || observations.length > MAX_ENTRIES) {
    throw new TypeError('A report can contain at most 20 observations');
  }
  if (!validClock(generatedAt)) throw new TypeError('Invalid report clock');
  const lines = [
    'AEGIS Health Vision — Personal observation notes',
    'Generated: ' + generatedAt,
    '',
    'IMPORTANT: This is a record of personal observations, not a diagnosis, risk score, medical assessment or treatment recommendation.',
    'It has not been reviewed by a clinician. Please discuss concerns with an appropriate healthcare professional.',
    '',
  ];
  observations.forEach((item, index) => {
    if (!item || typeof item !== 'object' || !KINDS.has(item.kind) ||
        typeof item.description !== 'string' || !item.description.trim() ||
        !validDate(item.observedOn)) {
      throw new TypeError('Invalid observation record');
    }
    lines.push(
      (index + 1) + '. ' + item.kind.toUpperCase(),
      'Date noticed: ' + item.observedOn,
      'Area: ' + (typeof item.bodyArea === 'string' ? item.bodyArea : 'Not recorded'),
      'What I noticed: ' + item.description,
      'Symptoms: ' + (typeof item.symptoms === 'string' && item.symptoms ? item.symptoms : 'Not recorded'),
      'Changes: ' + (typeof item.changes === 'string' && item.changes ? item.changes : 'Not recorded'),
      ''
    );
  });
  if (!observations.length) lines.push('No observations have been added.');
  lines.push('Images are not included in this report.');
  return lines.join('\n');
}
