const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const CHANNELS = new Set(['stable', 'beta', 'nightly']);
const CHANGE_TYPES = new Set(['security', 'feature', 'bugfix', 'compatibility', 'documentation']);

function parseVersion(value) {
  if (typeof value !== 'string' || !VERSION_PATTERN.test(value)) return null;
  return value.split('.').map(Number);
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) return 1;
    if (a[index] < b[index]) return -1;
  }
  return 0;
}

export function validateUpdateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { valid: false, errors: ['Manifest must be an object.'] };
  }

  if (manifest.schemaVersion !== 1) errors.push('Unsupported manifest schema version.');
  if (manifest.product !== 'aegis') errors.push('Manifest product must be aegis.');
  if (!parseVersion(manifest.version)) errors.push('Version must use numeric major.minor.patch format.');
  if (!CHANNELS.has(manifest.channel)) errors.push('Channel must be stable, beta or nightly.');
  if (!Number.isFinite(Date.parse(manifest.releasedAt))) errors.push('Release timestamp must be a valid date.');
  if (!parseVersion(manifest.minimumVersion)) errors.push('Minimum supported version must use numeric major.minor.patch format.');

  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
    errors.push('At least one update artifact is required.');
  } else {
    for (const [index, artifact] of manifest.artifacts.entries()) {
      let url;
      try {
        url = new URL(artifact?.url);
      } catch {
        errors.push(`Artifact ${index + 1} must have a valid HTTPS URL.`);
      }
      if (url && url.protocol !== 'https:') errors.push(`Artifact ${index + 1} must use HTTPS.`);
      if (typeof artifact?.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(artifact.sha256)) {
        errors.push(`Artifact ${index + 1} must include a valid SHA-256 digest.`);
      }
      if (typeof artifact?.platform !== 'string' || !artifact.platform.trim()) {
        errors.push(`Artifact ${index + 1} must identify a platform.`);
      }
    }
  }

  if (!Array.isArray(manifest.changes) || manifest.changes.length === 0) {
    errors.push('Release notes must contain at least one change.');
  } else {
    for (const [index, change] of manifest.changes.entries()) {
      if (!CHANGE_TYPES.has(change?.type)) errors.push(`Change ${index + 1} has an unsupported type.`);
      if (typeof change?.summary !== 'string' || !change.summary.trim()) errors.push(`Change ${index + 1} needs a summary.`);
    }
  }

  for (const flag of ['requiresMigration', 'permissionsChanged', 'securityUpdate']) {
    if (typeof manifest[flag] !== 'boolean') errors.push(`${flag} must be an explicit boolean.`);
  }

  return { valid: errors.length === 0, errors };
}

export function classifyUpdateRisk(manifest) {
  if (manifest?.securityUpdate === true ||
      manifest?.permissionsChanged === true ||
      manifest?.requiresMigration === true) return 'high';
  return 'low';
}

export function canAutoApplyUpdate(manifest, currentVersion) {
  if (!validateUpdateManifest(manifest).valid) return false;
  const current = parseVersion(currentVersion);
  const next = parseVersion(manifest.version);
  const minimum = parseVersion(manifest.minimumVersion);
  if (!current || !next || !minimum) return false;
  if (manifest.channel !== 'stable' || classifyUpdateRisk(manifest) !== 'low') return false;
  if (compareVersions(currentVersion, manifest.minimumVersion) < 0) return false;
  if (compareVersions(manifest.version, currentVersion) !== 1) return false;
  return next[0] === current[0] && next[1] === current[1];
}
