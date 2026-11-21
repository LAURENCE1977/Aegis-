const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const ECOSYSTEM_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const PACKAGE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+@/-]{0,254}$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.+_~:-]{0,127}$/;
const MAX_INVENTORY_PACKAGES = 500;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonicalTimestamp(value, label) {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a canonical UTC timestamp.');
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new TypeError(label + ' must be a canonical UTC timestamp.');
  }
  return parsed.getTime();
}

function boundedText(value, label, max, pattern) {
  if (typeof value !== 'string' || value.length < 1 || value.length > max ||
      value.trim() !== value || !pattern.test(value) || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError(label + ' is invalid.');
  }
  return value;
}

function normalizeInventoryPackage(value) {
  if (!isRecord(value)) throw new TypeError('Inventory package must be an object.');
  const ecosystem = boundedText(value.ecosystem, 'Inventory ecosystem', 64, ECOSYSTEM_PATTERN);
  const name = boundedText(value.name, 'Inventory package name', 255, PACKAGE_PATTERN);
  const version = boundedText(value.version, 'Inventory package version', 128, VERSION_PATTERN);
  const result = { ecosystem, name, version };
  if (value.purl !== undefined) {
    const purl = boundedText(value.purl, 'Inventory package URL', 512, /^pkg:[a-z0-9.+-]+\/[^\s?#]+$/i);
    if (purl.includes('..')) throw new TypeError('Inventory package URL is invalid.');
    result.purl = purl;
  }
  return result;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

/**
 * Compare a caller-supplied, timestamped inventory snapshot with an already
 * normalised OSV advisory record. Only exact package identity and explicit
 * version-list equality are evaluated. Version ranges are deliberately left
 * indeterminate until a separately reviewed ecosystem-specific evaluator exists.
 */
export function createAdvisoryInventoryAssessment({
  advisoryRecord,
  inventory,
  observedAt,
} = {}) {
  if (!isRecord(advisoryRecord) ||
      advisoryRecord.schemaVersion !== 'aegis.security-advisory-evidence.v1' ||
      !isRecord(advisoryRecord.source) ||
      advisoryRecord.source.database !== 'OSV' ||
      advisoryRecord.source.contentIsUntrusted !== true ||
      !isRecord(advisoryRecord.advisory) ||
      !Array.isArray(advisoryRecord.affected) ||
      advisoryRecord.affected.length < 1 || advisoryRecord.affected.length > 50) {
    throw new TypeError('A normalised advisory evidence record is required.');
  }
  if (!isRecord(inventory)) throw new TypeError('Inventory snapshot is required.');
  const snapshotId = boundedText(inventory.snapshotId, 'Inventory snapshot identifier', 128, ID_PATTERN);
  if (!Array.isArray(inventory.packages) || inventory.packages.length < 1 ||
      inventory.packages.length > MAX_INVENTORY_PACKAGES) {
    throw new TypeError('Inventory package list must contain between 1 and 500 entries.');
  }

  const assessedAtMs = canonicalTimestamp(observedAt, 'Assessment timestamp');
  const advisoryObservedAtMs = canonicalTimestamp(advisoryRecord.observedAt, 'Advisory observation timestamp');
  const inventoryObservedAtMs = canonicalTimestamp(inventory.observedAt, 'Inventory observation timestamp');
  if (advisoryObservedAtMs > assessedAtMs || inventoryObservedAtMs > assessedAtMs) {
    throw new RangeError('Evidence observations cannot be newer than the assessment.');
  }

  const advisoryId = boundedText(advisoryRecord.advisory.id, 'Advisory identifier', 128, ID_PATTERN);
  const affected = advisoryRecord.affected.map(item => {
    if (!isRecord(item) || !isRecord(item.package)) {
      throw new TypeError('Advisory affected package identity is invalid.');
    }
    const ecosystem = boundedText(item.package.ecosystem, 'Advisory ecosystem', 64, ECOSYSTEM_PATTERN);
    const name = boundedText(item.package.name, 'Advisory package name', 255, PACKAGE_PATTERN);
    const versions = item.versions === undefined ? [] : item.versions;
    const ranges = item.ranges === undefined ? [] : item.ranges;
    if (!Array.isArray(versions) || !Array.isArray(ranges)) {
      throw new TypeError('Advisory version or range evidence is invalid.');
    }
    return { ecosystem, name, versions, hasRanges: ranges.length > 0 };
  });

  const packages = inventory.packages.map(normalizeInventoryPackage);
  const identities = new Set();
  for (const item of packages) {
    const identity = item.ecosystem + '\u0000' + item.name + '\u0000' + item.version;
    if (identities.has(identity)) throw new TypeError('Duplicate inventory package identity and version.');
    identities.add(identity);
  }

  const matches = packages.map(item => {
    const candidates = affected.filter(candidate =>
      candidate.ecosystem === item.ecosystem && candidate.name === item.name);
    let status;
    if (candidates.length === 0) {
      status = 'no_matching_advisory_package';
    } else if (candidates.some(candidate => candidate.versions.includes(item.version))) {
      status = 'exact_version_listed';
    } else if (candidates.some(candidate => candidate.hasRanges)) {
      status = 'range_evaluation_required';
    } else {
      status = 'not_listed_in_explicit_affected_versions';
    }
    return {
      ecosystem: item.ecosystem,
      packageName: item.name,
      installedVersion: item.version,
      ...(item.purl ? { purl: item.purl } : {}),
      status,
    };
  }).sort((a, b) =>
    (a.ecosystem + '/' + a.packageName + '/' + a.installedVersion)
      .localeCompare(b.ecosystem + '/' + b.packageName + '/' + b.installedVersion));

  const status = matches.some(item => item.status === 'exact_version_listed')
    ? 'potentially_affected'
    : matches.some(item => item.status === 'range_evaluation_required')
      ? 'indeterminate'
      : 'no_exact_version_match';

  return deepFreeze({
    schemaVersion: 'aegis.advisory-inventory-assessment.v1',
    source: {
      advisoryId,
      advisoryObservedAt: new Date(advisoryObservedAtMs).toISOString(),
      inventorySnapshotId: snapshotId,
      inventoryObservedAt: new Date(inventoryObservedAtMs).toISOString(),
    },
    observedAt: new Date(assessedAtMs).toISOString(),
    matching: {
      method: 'exact_package_identity_and_explicit_version_equality',
      versionRangeEvaluationPerformed: false,
      safetyConclusion: 'none',
    },
    matches,
    assessment: { status },
    authority: {
      remediate: false,
      blockTraffic: false,
      changeConfiguration: false,
      sentinelApprovalRequired: true,
      response: 'not_authorised',
    },
  });
}
