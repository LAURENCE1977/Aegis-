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

function hasControlCharacters(value) {
  return [...value].some(character => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

function text(value, label, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > max ||
      hasControlCharacters(value)) {
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

function safePath(value) {
  if (typeof value !== 'string' || !value || value.length > 240 ||
      value.startsWith('/') || value.includes('\\\\') ||
      hasControlCharacters(value) ||
      value.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new TypeError('Invalid mobile security finding location');
  }
  return value;
}

/**
 * Normalize a narrow static-analysis adapter payload into untrusted AEGIS evidence.
 * This does not invoke MobSF, install/run an app, accept dynamic results or authorize remediation.
 */
export function normalizeMobileSecurityReport(report) {
  if (!exactKeys(report, ROOT_KEYS) || Object.keys(report).length !== ROOT_KEYS.length) {
    throw new TypeError('Invalid mobile security report fields');
  }
  let serialized;
  try { serialized = JSON.stringify(report); }
  catch { throw new TypeError('Invalid mobile security report'); }
  if (typeof serialized !== 'string' || new TextEncoder().encode(serialized).byteLength > MAX_REPORT_BYTES) {
    throw new TypeError('Mobile security report exceeds the 1 MiB limit');
  }

  if (report.tool !== 'mobsf') throw new TypeError('Unsupported mobile security tool');
  const toolVersion = text(report.toolVersion, 'tool version', 64);
  if (!exactKeys(report.artifact, ['sha256', 'platform', 'packageId'], ['sha256', 'platform']) ||
      !PLATFORMS.has(report.artifact.platform)) {
    throw new TypeError('Invalid mobile security artifact');
  }
  const artifact = {
    sha256: digest(report.artifact.sha256, 'artifact digest'),
    platform: report.artifact.platform,
    ...(report.artifact.packageId === undefined ? {} : {
      packageId: text(report.artifact.packageId, 'package identifier', 255),
    }),
  };

  if (typeof report.generatedAt !== 'string' ||
      !Number.isFinite(Date.parse(report.generatedAt)) ||
      new Date(Date.parse(report.generatedAt)).toISOString() !== report.generatedAt) {
    throw new TypeError('Invalid mobile security report timestamp');
  }
  if (!Array.isArray(report.findings) || report.findings.length > MAX_FINDINGS) {
    throw new TypeError('Invalid mobile security finding count');
  }

  const findings = report.findings.map((finding, index) => {
    if (!exactKeys(finding, FINDING_KEYS, [
      'ruleId', 'title', 'severity', 'confidence', 'evidenceDigest', 'remediation',
    ])) {
      throw new TypeError('Invalid mobile security finding');
    }
    if (!SEVERITIES.has(finding.severity) ||
        typeof finding.confidence !== 'number' || !Number.isFinite(finding.confidence) ||
        finding.confidence < 0 || finding.confidence > 1) {
      throw new TypeError('Invalid mobile security finding');
    }
    let location;
    if (finding.location !== undefined) {
      if (!exactKeys(finding.location, ['path', 'line', 'column'], ['path']) ||
          (finding.location.line !== undefined &&
            (!Number.isSafeInteger(finding.location.line) || finding.location.line < 1)) ||
          (finding.location.column !== undefined &&
            (!Number.isSafeInteger(finding.location.column) || finding.location.column < 1))) {
        throw new TypeError('Invalid mobile security finding location');
      }
      location = {
        path: safePath(finding.location.path),
        ...(finding.location.line === undefined ? {} : { line: finding.location.line }),
        ...(finding.location.column === undefined ? {} : { column: finding.location.column }),
      };
    }

    return {
      id: 'mobsf-' + String(index + 1).padStart(5, '0'),
      ruleId: text(finding.ruleId, 'rule identifier', 128),
      title: text(finding.title, 'finding title', 300),
      severity: finding.severity,
      confidence: finding.confidence,
      ...(finding.component === undefined ? {} : {
        component: text(finding.component, 'finding component', 255),
      }),
      ...(location === undefined ? {} : { location }),
      evidence: { digest: digest(finding.evidenceDigest, 'finding evidence digest') },
      remediation: text(finding.remediation, 'finding remediation', 2000),
      status: 'unreviewed',
    };
  });

  return {
    schemaVersion: '1.0.0',
    tool: 'mobsf',
    toolVersion,
    artifact,
    generatedAt: report.generatedAt,
    analysisMode: 'static',
    findings,
    authority: 'none',
    execution: 'none',
    remediationPermitted: false,
  };
}
