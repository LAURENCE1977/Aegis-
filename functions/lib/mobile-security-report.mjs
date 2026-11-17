const PLATFORMS = new Set(['android', 'ios', 'windows']);
const SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);
const ROOT_KEYS = ['tool', 'toolVersion', 'artifact', 'generatedAt', 'findings'];
const FINDING_KEYS = ['ruleId', 'title', 'severity', 'confidence', 'component', 'location', 'evidenceDigest', 'remediation'];
const MAX_REPORT_BYTES = 1024 * 1024;
const MAX_FINDINGS = 5000;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, allowed, required = allowed) {
  return isRecord(value) &&
    Object.keys(value).every(key => allowed.includes(key)) &&
    required.every(key => Object.hasOwn(value, key));
}

function text(value, label, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > max ||
      hasControlCharacters(value) ||
    throw new TypeError('Invalid mobile security ' + label);
  }
  return value.trim();
}

function digest(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new TypeError('Invalid mobile security ' + label);
  }
  return value.toLowerCase();
}

function hasControlCharacters(value) {
  return [...value].some(character => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

