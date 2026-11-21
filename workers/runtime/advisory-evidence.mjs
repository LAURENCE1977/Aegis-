const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const PACKAGE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._+@/-]{0,254}$/;
const ECOSYSTEM_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const SHA_PATTERN = /^[a-f0-9]{40,64}$/i;
const MAX_AFFECTED = 50;
const MAX_RANGES = 20;
const MAX_EVENTS = 100;
const MAX_VERSIONS = 200;
const MAX_REFERENCES = 20;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function timestamp(value, field) {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    throw new TypeError(field + ' timestamp must be canonical UTC.');
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new TypeError(field + ' timestamp must be canonical UTC.');
  }
  return parsed.toISOString();
}

function boundedText(value, field, max, optional = false) {
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    throw new TypeError(field + ' must be non-empty bounded text.');
  }
  return value.trim();
}

function packageIdentity(value) {
  if (!isRecord(value)) throw new TypeError('Affected package identity is required.');
  const ecosystem = boundedText(value.ecosystem, 'Package ecosystem', 64);
  const name = boundedText(value.name, 'Package name', 255);
  if (!ECOSYSTEM_PATTERN.test(ecosystem) || !PACKAGE_TOKEN.test(name) ||
      name.includes('..') || name.startsWith('/') || name.endsWith('/')) {
    throw new TypeError('Affected package identity is invalid.');
  }
  const result = { ecosystem, name };
  if (value.purl !== undefined) {
    const purl = boundedText(value.purl, 'Package URL', 512);
    if (!/^pkg:[a-z0-9.+-]+\/[^\s?#]+$/i.test(purl) || purl.includes('..')) {
      throw new TypeError('Affected package URL is invalid.');
    }
    result.purl = purl;
  }
  return result;
}

function normalizeRanges(ranges) {
  if (!Array.isArray(ranges) || ranges.length < 1 || ranges.length > MAX_RANGES) {
    throw new TypeError('Affected package ranges must contain between 1 and 20 entries.');
  }
  return ranges.map(range => {
    if (!isRecord(range) || !['SEMVER', 'ECOSYSTEM', 'GIT'].includes(range.type) ||
        !Array.isArray(range.events) || range.events.length < 1 || range.events.length > MAX_EVENTS) {
      throw new TypeError('Affected range is invalid.');
    }
    let introducedSeen = false;
    const events = range.events.map(event => {
      if (!isRecord(event)) throw new TypeError('Affected range event is invalid.');
      const keys = Object.keys(event);
      if (keys.length !== 1 || !['introduced', 'fixed', 'last_affected', 'limit'].includes(keys[0])) {
        throw new TypeError('Affected range event type is invalid.');
      }
      const kind = keys[0];
      const value = boundedText(event[kind], 'Affected range event', 256);
      if (kind === 'introduced') {
        if (introducedSeen) throw new TypeError('Affected range contains duplicate introduced events.');
        introducedSeen = true;
      }
      if (kind !== 'introduced' && !introducedSeen) {
        throw new TypeError('Affected range must begin with an introduced event.');
      }
      if (range.type === 'GIT' && !SHA_PATTERN.test(value)) {
        throw new TypeError('Git affected range events must use immutable commit SHAs.');
      }
      return { [kind]: value };
    });
    return { type: range.type, events };
  });
}

function normalizeSeverity(severity) {
  if (severity === undefined) return undefined;
  if (!Array.isArray(severity) || severity.length > 10) {
    throw new TypeError('Advisory severity entries are invalid.');
  }
  return severity.map(item => {
    if (!isRecord(item) || !['CVSS_V2', 'CVSS_V3', 'CVSS_V4'].includes(item.type)) {
      throw new TypeError('Advisory severity type is unsupported.');
    }
    const score = boundedText(item.score, 'CVSS vector', 256);
    const version = item.type === 'CVSS_V2' ? '2' : item.type === 'CVSS_V3' ? '3' : '4';
    if (!score.startsWith('CVSS:' + version + '.') || !score.includes('/')) {
      throw new TypeError('CVSS vector does not match its declared version.');
    }
    return { type: item.type, score };
  });
}

/**
 * Converts an OSV-shaped advisory payload into a bounded, immutable evidence
 * record. This is a pure normalizer: it does not fetch, interpret or remediate.
 */
export function createAdvisoryEvidenceRecord({ advisory, observedAt } = {}) {
  if (!isRecord(advisory)) throw new TypeError('Advisory payload is required.');
  const id = boundedText(advisory.id, 'Advisory identifier', 128);
  if (!ID_PATTERN.test(id) || id.includes('..')) {
    throw new TypeError('Advisory identifier is invalid.');
  }
  const modifiedAt = timestamp(advisory.modified, 'Modified');
  const publishedAt = advisory.published === undefined ? undefined : timestamp(advisory.published, 'Published');
  const observed = timestamp(observedAt, 'Observed');
  if (Date.parse(observed) > Date.now()) {
    throw new TypeError('Future observation timestamps are not accepted.');
  }
  if (Date.parse(modifiedAt) > Date.parse(observed) ||
      (publishedAt && Date.parse(publishedAt) > Date.parse(modifiedAt))) {
    throw new TypeError('Advisory timestamps are not chronologically consistent.');
  }

  const summary = boundedText(advisory.summary, 'Advisory summary', 2000);
  if (!Array.isArray(advisory.affected) || advisory.affected.length < 1 ||
      advisory.affected.length > MAX_AFFECTED) {
    throw new TypeError('Advisory affected package list must contain between 1 and 50 entries.');
  }

  const affected = advisory.affected.map(item => {
    if (!isRecord(item)) throw new TypeError('Affected package entry is invalid.');
    const result = { package: packageIdentity(item.package) };
    if (item.ranges !== undefined) result.ranges = normalizeRanges(item.ranges);
    if (item.versions !== undefined) {
      if (!Array.isArray(item.versions) || item.versions.length > MAX_VERSIONS) {
        throw new TypeError('Affected package version list is invalid.');
      }
      result.versions = item.versions.map(version => boundedText(version, 'Affected version', 128));
    }
    if (!result.ranges && !result.versions?.length) {
      throw new TypeError('Affected package requires ranges or explicit versions.');
    }
    return result;
  }).sort((a, b) => (a.package.ecosystem + '/' + a.package.name)
    .localeCompare(b.package.ecosystem + '/' + b.package.name));

  let references;
  if (advisory.references !== undefined) {
    if (!Array.isArray(advisory.references) || advisory.references.length > MAX_REFERENCES) {
      throw new TypeError('Advisory references are invalid.');
    }
    references = advisory.references.map(reference => {
      if (!isRecord(reference) || !['ADVISORY', 'ARTICLE', 'DETECTION', 'DISCUSSION', 'EVIDENCE', 'FIX', 'INTRO', 'PACKAGE', 'REPORT', 'WEB'].includes(reference.type)) {
        throw new TypeError('Advisory reference type is unsupported.');
      }
      const url = boundedText(reference.url, 'Advisory reference URL', 2048);
      let parsed;
      try { parsed = new URL(url); } catch { throw new TypeError('Advisory reference URL is invalid.'); }
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) {
        throw new TypeError('Advisory references must be credential-free HTTPS URLs.');
      }
      return { type: reference.type, url: parsed.toString() };
    }).sort((a, b) => a.url.localeCompare(b.url));
  }

  const severity = normalizeSeverity(advisory.severity);
  const record = {
    schemaVersion: 'aegis.security-advisory-evidence.v1',
    source: {
      database: 'OSV',
      advisoryId: id,
      contentIsUntrusted: true,
    },
    advisory: {
      id,
      modifiedAt,
      ...(publishedAt ? { publishedAt } : {}),
      summary,
    },
    affected,
    observedAt: observed,
    assessment: {
      status: 'unassessed',
      severityIsSourceSupplied: severity !== undefined,
    },
    authority: {
      remediate: false,
      blockTraffic: false,
      changeConfiguration: false,
      sentinelApprovalRequired: true,
      response: 'not_authorised',
    },
  };
  if (references !== undefined) record.references = references;
  if (severity !== undefined) record.severity = severity;

  const deepFreeze = value => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const child of Object.values(value)) deepFreeze(child);
    }
    return value;
  };
  return deepFreeze(record);
}
