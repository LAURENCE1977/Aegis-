const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REGIONS = /^[a-z0-9][a-z0-9-]{0,40}$/;
const METRICS = /^[a-z][a-z0-9._-]{0,60}$/;
const PERIODS = new Set(['minute', 'hour', 'day', 'month', 'year', 'total']);
const DURATIONS = new Set(['ongoing', 'limited', 'one-time']);
const COMMERCIAL_USE = new Set(['allowed', 'prohibited', 'unknown']);
const OVERAGE = new Set(['blocked', 'paid', 'unknown']);
const CONFIDENCE = new Set(['high', 'medium', 'low']);
const STATUSES = new Set(['candidate', 'verified', 'expired']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireText(value, label, max = 500) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
      /[\\u0000-\\u001f\\u007f]/.test(value)) {
    throw new TypeError('Invalid free-tier ' + label);
  }
}

function requireHttpsUrl(value, label) {
  requireText(value, label, 2048);
  let url;
  try { url = new URL(value); } catch { throw new TypeError('Invalid free-tier ' + label); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new TypeError('Invalid free-tier ' + label);
  }
}

function validTimestamp(value) {
  if (typeof value !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() ===
    (value.includes('.') ? value : value.replace('Z', '.000Z'));
}

export function validateFreeTierRecord(record, now = Date.now()) {
  if (!isRecord(record)) throw new TypeError('Free-tier record must be an object');
  if (!ID_PATTERN.test(record.id ?? '')) throw new TypeError('Invalid free-tier identifier');
  requireText(record.provider, 'provider', 160);
  requireText(record.service, 'service', 160);
  if (!ID_PATTERN.test(record.category ?? '')) throw new TypeError('Invalid free-tier category');
  requireText(record.allowance, 'allowance description', 2000);
  if (!DURATIONS.has(record.duration)) throw new TypeError('Invalid free-tier duration');
  if (typeof record.cardRequired !== 'boolean') throw new TypeError('Card requirement must be explicit');
  if (!COMMERCIAL_USE.has(record.commercialUse)) throw new TypeError('Commercial-use status must be explicit');
  if (!OVERAGE.has(record.overage)) throw new TypeError('Overage behaviour must be explicit');
  if (!Array.isArray(record.regions) || record.regions.length > 100 ||
      record.regions.some((region) => typeof region !== 'string' || !REGIONS.test(region)) ||
      new Set(record.regions).size !== record.regions.length) {
    throw new TypeError('Invalid free-tier regions');
  }
  if (!Array.isArray(record.quotas) || record.quotas.length > 50) throw new TypeError('Invalid free-tier quotas');
  const quotaKeys = new Set();
  for (const quota of record.quotas) {
    if (!isRecord(quota) || !METRICS.test(quota.metric ?? '') ||
        !Number.isFinite(quota.limit) || quota.limit < 0 || !PERIODS.has(quota.period)) {
      throw new TypeError('Invalid free-tier quota');
    }
    const key = quota.metric + ':' + quota.period;
    if (quotaKeys.has(key)) throw new TypeError('Duplicate free-tier quota');
    quotaKeys.add(key);
  }
  requireHttpsUrl(record.pricingUrl, 'official pricing URL');
  requireHttpsUrl(record.termsUrl, 'official terms URL');
  if (!validTimestamp(record.verifiedAt) || !Number.isFinite(now) || Date.parse(record.verifiedAt) > now) {
    throw new TypeError('Invalid or future free-tier verification timestamp');
  }
  if (!CONFIDENCE.has(record.confidence)) throw new TypeError('Invalid free-tier confidence');
  if (!STATUSES.has(record.status)) throw new TypeError('Invalid free-tier status');
  return true;
}

export function isFreeTierRecordCurrent(record, now = Date.now(), maxAgeDays = 30) {
  validateFreeTierRecord(record, now);
  if (!Number.isInteger(maxAgeDays) || maxAgeDays < 1 || maxAgeDays > 365) {
    throw new TypeError('Invalid free-tier verification age');
  }
  return now - Date.parse(record.verifiedAt) <= maxAgeDays * 24 * 60 * 60 * 1000 &&
    record.status !== 'expired';
}

function clone(value) {
  return structuredClone(value);
}

export function createFreeTierLedger(records = []) {
  if (!Array.isArray(records) || records.length > 10000) throw new TypeError('Invalid free-tier ledger');
  const byId = new Map();
  for (const record of records) {
    validateFreeTierRecord(record);
    if (byId.has(record.id)) throw new TypeError('Duplicate free-tier record identifier');
    byId.set(record.id, clone(record));
  }
  return Object.freeze({
    list() {
      return [...byId.values()].sort((a, b) =>
        a.provider.localeCompare(b.provider) || a.service.localeCompare(b.service)).map(clone);
    },
    get(id) {
      if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null;
      const record = byId.get(id);
      return record ? clone(record) : null;
    },
    search(query) {
      if (typeof query !== 'string' || !query.trim()) return [];
      const needle = query.trim().toLocaleLowerCase();
      return [...byId.values()]
        .filter((record) => [
          record.id, record.provider, record.service, record.category, record.allowance,
          record.duration, record.commercialUse, record.overage, ...record.regions,
          ...record.quotas.map((quota) => quota.metric + ' ' + quota.period),
        ].some((value) => value.toLocaleLowerCase().includes(needle)))
        .sort((a, b) => a.provider.localeCompare(b.provider) || a.service.localeCompare(b.service))
        .map(clone);
    },
  });
}
