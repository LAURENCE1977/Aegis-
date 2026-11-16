const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CAPABILITY_PATTERN = /^[a-z][a-z0-9-]{0,31}\.[a-z][a-z0-9-]{0,47}$/;
const SCOPE_PATTERN = /^[a-z][a-z0-9-]{0,40}:[a-z][a-z0-9-]{0,50}(?::[a-z0-9._-]{1,80})?$/;
const HOST_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const EFFECTS = new Set(['read', 'write', 'execute']);
const RISKS = new Set(['low', 'medium', 'high', 'critical']);
const APPROVALS = new Set(['none', 'human-always']);
const STATUSES = new Set(['candidate', 'reviewed', 'approved', 'disabled']);
const LICENCE_REVIEWS = new Set(['verified', 'review-required', 'not-applicable']);
const AUTH_MODES = new Set(['none', 'session', 'oauth2', 'secret-reference']);
const DATA_CLASSIFICATIONS = new Set(['public', 'internal', 'confidential', 'restricted']);
const INTERFACE_KINDS = new Set(['internal', 'mcp', 'openapi', 'http']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireText(value, label, maxLength = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength ||
      /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError('Invalid ' + label);
  }
}

function requireSlug(value, label) {
  if (typeof value !== 'string' || value.length > 80 || !ID_PATTERN.test(value)) {
    throw new TypeError('Invalid ' + label);
  }
}

function requireArray(value, label, { min = 0, max = 100, pattern } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new TypeError('Invalid ' + label);
  }
  if (value.some((item) => typeof item !== 'string' || !item.trim() || item.length > 200 ||
      (pattern && !pattern.test(item)))) {
    throw new TypeError('Invalid ' + label);
  }
  if (new Set(value).size !== value.length) throw new TypeError('Duplicate ' + label);
}

function requireHttpsUrl(value, label) {
  requireText(value, label, 2048);
  let parsed;
  try { parsed = new URL(value); } catch { throw new TypeError('Invalid ' + label); }
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) {
    throw new TypeError('Invalid ' + label);
  }
}

function validateInternalPath(path) {
  if (typeof path !== 'string' || path.length > 200 ||
      !/^\/[A-Za-z0-9/_-]+$/.test(path) || path.includes('//') || path.split('/').includes('..')) {
    throw new TypeError('Invalid capability interface path');
  }
}

function validateCapabilityAction(action) {
  if (!isRecord(action)) throw new TypeError('Invalid capability action');
  requireSlug(action.id, 'capability action identifier');
  if (typeof action.capability !== 'string' || !CAPABILITY_PATTERN.test(action.capability)) {
    throw new TypeError('Invalid capability action name');
  }
  if (!EFFECTS.has(action.effect)) throw new TypeError('Invalid capability effect');
  if (!RISKS.has(action.risk)) throw new TypeError('Invalid capability risk');
  if (!APPROVALS.has(action.approval)) throw new TypeError('Invalid capability approval policy');
  if ((action.effect === 'write' || action.effect === 'execute' ||
      action.risk === 'high' || action.risk === 'critical') && action.approval !== 'human-always') {
    throw new TypeError('Write, execute, high-risk and critical actions require human approval');
  }
  requireArray(action.requiredScopes, 'capability required scopes', {
    max: 50,
    pattern: SCOPE_PATTERN,
  });
}

export function validateCapabilityManifest(manifest) {
  if (!isRecord(manifest)) throw new TypeError('Capability manifest must be an object');
  requireSlug(manifest.id, 'capability manifest identifier');
  if (typeof manifest.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)) {
    throw new TypeError('Invalid capability manifest version');
  }
  requireText(manifest.name, 'capability name', 120);
  requireText(manifest.description, 'capability description', 1000);

  if (!isRecord(manifest.provider)) throw new TypeError('Invalid capability provider');
  requireSlug(manifest.provider.id, 'capability provider identifier');
  if (!['builtin', 'external'].includes(manifest.provider.kind)) throw new TypeError('Invalid capability provider kind');

  if (!isRecord(manifest.interface) || !INTERFACE_KINDS.has(manifest.interface.kind)) {
    throw new TypeError('Invalid capability interface');
  }
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(manifest.interface.method)) {
    throw new TypeError('Invalid capability interface method');
  }
  if (manifest.interface.kind === 'internal') {
    validateInternalPath(manifest.interface.path);
    if (manifest.interface.endpoint !== undefined) throw new TypeError('Invalid internal capability interface');
  } else {
    requireHttpsUrl(manifest.interface.endpoint, 'capability interface endpoint');
    if (manifest.interface.path !== undefined) throw new TypeError('Invalid external capability interface');
  }

  if (!Array.isArray(manifest.actions) || manifest.actions.length < 1 || manifest.actions.length > 50) {
    throw new TypeError('Invalid capability actions');
  }
  const actionIds = new Set();
  for (const action of manifest.actions) {
    validateCapabilityAction(action);
    if (actionIds.has(action.id)) throw new TypeError('Duplicate capability action identifier');
    actionIds.add(action.id);
  }

  if (!isRecord(manifest.data) || !DATA_CLASSIFICATIONS.has(manifest.data.classification)) {
    throw new TypeError('Invalid capability data classification');
  }
  requireArray(manifest.data.reads, 'capability data reads');
  requireArray(manifest.data.writes, 'capability data writes');

  if (!isRecord(manifest.network)) throw new TypeError('Invalid capability network policy');
  requireArray(manifest.network.egressHosts, 'capability egress hosts', {
    max: 50,
    pattern: HOST_PATTERN,
  });

  if (!isRecord(manifest.auth) || !AUTH_MODES.has(manifest.auth.mode)) {
    throw new TypeError('Invalid capability authentication mode');
  }
  if (manifest.auth.mode === 'secret-reference') {
    if (typeof manifest.auth.secretRef !== 'string' ||
        !/^secret:\/\/[A-Za-z0-9][A-Za-z0-9._/-]{2,120}$/.test(manifest.auth.secretRef) ||
        manifest.auth.secretRef.includes('..')) {
      throw new TypeError('Invalid secret reference; store only a secret identifier, never a secret value');
    }
  } else if (manifest.auth.secretRef !== undefined) {
    throw new TypeError('Secret reference is not valid for this authentication mode');
  }

  if (!isRecord(manifest.limits)) throw new TypeError('Invalid capability limits');
  const { requestsPerMinute, timeoutMs, maxRequestBytes } = manifest.limits;
  if (!Number.isInteger(requestsPerMinute) || requestsPerMinute < 1 || requestsPerMinute > 10000 ||
      !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000 ||
      !Number.isInteger(maxRequestBytes) || maxRequestBytes < 256 || maxRequestBytes > 1048576) {
    throw new TypeError('Invalid capability limits');
  }

  if (!isRecord(manifest.provenance)) throw new TypeError('Invalid capability provenance');
  requireHttpsUrl(manifest.provenance.sourceUrl, 'capability provenance URL');
  requireText(manifest.provenance.revision, 'capability provenance revision', 160);

  if (!isRecord(manifest.licence)) throw new TypeError('Invalid capability licence');
  requireText(manifest.licence.identifier, 'capability licence identifier', 100);
  if (!LICENCE_REVIEWS.has(manifest.licence.review)) throw new TypeError('Invalid capability licence review');
  if (manifest.status === 'approved' &&
      !(manifest.licence.review === 'verified' ||
        (manifest.licence.review === 'not-applicable' && manifest.licence.identifier === 'first-party'))) {
    throw new TypeError('Approved capabilities require a completed licence review');
  }
  if (!STATUSES.has(manifest.status)) throw new TypeError('Invalid capability status');
  return true;
}

const SOURCE_URL = 'https://github.com/LAURENCE1977/Aegis-';
const SOURCE_REVISION = '97df04aa96ea03f0e1efa18653071f1c95e6f7ae';

const CAPABILITY_MANIFESTS = [
  {
    id: 'aegis-github-public-discovery',
    version: '0.1.0',
    name: 'Public GitHub repository discovery',
    description: 'Read public GitHub repository metadata without fetching or executing source code.',
    provider: { id: 'aegis-core', kind: 'builtin' },
    interface: { kind: 'internal', method: 'POST', path: '/api/sentinel/github-discover' },
    actions: [{
      id: 'discover',
      capability: 'source.discover',
      effect: 'read',
      risk: 'low',
      approval: 'none',
      requiredScopes: ['github:public-metadata:read'],
    }],
    data: { classification: 'public', reads: ['public GitHub repository metadata'], writes: [] },
    network: { egressHosts: ['api.github.com'] },
    auth: { mode: 'session' },
    limits: { requestsPerMinute: 30, timeoutMs: 5000, maxRequestBytes: 4096 },
    provenance: { sourceUrl: SOURCE_URL, revision: SOURCE_REVISION },
    licence: { identifier: 'first-party', review: 'not-applicable' },
    status: 'approved',
  },
  {
    id: 'aegis-module-catalogue',
    version: '0.1.0',
    name: 'AEGIS module catalogue',
    description: 'Read the descriptive module catalogue; declarations do not grant permissions or execute modules.',
    provider: { id: 'aegis-core', kind: 'builtin' },
    interface: { kind: 'internal', method: 'GET', path: '/api/modules' },
    actions: [{
      id: 'list',
      capability: 'module.list',
      effect: 'read',
      risk: 'low',
      approval: 'none',
      requiredScopes: ['aegis:module-catalogue:read'],
    }],
    data: { classification: 'internal', reads: ['AEGIS module metadata'], writes: [] },
    network: { egressHosts: [] },
    auth: { mode: 'session' },
    limits: { requestsPerMinute: 60, timeoutMs: 3000, maxRequestBytes: 1024 },
    provenance: { sourceUrl: SOURCE_URL, revision: SOURCE_REVISION },
    licence: { identifier: 'first-party', review: 'not-applicable' },
    status: 'approved',
  },
  {
    id: 'aegis-composio-github-readonly',
    version: '0.1.0',
    name: 'Composio GitHub repository metadata',
    description: 'Read repository metadata through a pinned Composio session after exact-resource Sentinel authorization.',
    provider: { id: 'composio', kind: 'external' },
    interface: { kind: 'internal', method: 'POST', path: '/api/sentinel/composio-github-repository' },
    actions: [{
      id: 'get-repository',
      capability: 'github.repository-read',
      effect: 'read',
      risk: 'medium',
      approval: 'none',
      requiredScopes: ['github:repository:read'],
    }],
    data: {
      classification: 'confidential',
      reads: ['GitHub repository metadata, including private repository metadata when the connected account permits it'],
      writes: [],
    },
    network: { egressHosts: ['backend.composio.dev'] },
    auth: { mode: 'secret-reference', secretRef: 'secret://connections/composio-github-readonly' },
    limits: { requestsPerMinute: 20, timeoutMs: 8000, maxRequestBytes: 2048 },
    provenance: { sourceUrl: SOURCE_URL, revision: SOURCE_REVISION },
    licence: { identifier: 'first-party', review: 'not-applicable' },
    status: 'approved',
  },

  {
    id: 'aegis-composio-github-pull-request-readonly',
    version: '0.1.0',
    name: 'Composio GitHub pull request metadata',
    description: 'Read a single pull request and bounded branch/change metadata through an approved Composio session.',
    provider: { id: 'composio', kind: 'external' },
    interface: { kind: 'internal', method: 'POST', path: '/api/sentinel/composio-github-pull-request' },
    actions: [{
      id: 'get-pull-request',
      capability: 'github.pull-request-read',
      effect: 'read',
      risk: 'medium',
      approval: 'none',
      requiredScopes: ['github:pull-request:read'],
    }],
    data: {
      classification: 'confidential',
      reads: ['GitHub pull request title, state, draft/merge status, branch references and change counts'],
      writes: [],
    },
    network: { egressHosts: ['backend.composio.dev'] },
    auth: { mode: 'secret-reference', secretRef: 'secret://connections/composio-github-readonly' },
    limits: { requestsPerMinute: 20, timeoutMs: 8000, maxRequestBytes: 2048 },
    provenance: { sourceUrl: SOURCE_URL, revision: SOURCE_REVISION },
    licence: { identifier: 'first-party', review: 'not-applicable' },
    status: 'approved',
  },

  {
    id: 'aegis-composio-github-workflow-readonly',
    version: '0.1.0',
    name: 'Composio GitHub workflow run metadata',
    description: 'Read at most ten workflow run summaries for one exact repository and optional branch.',
    provider: { id: 'composio', kind: 'external' },
    interface: { kind: 'internal', method: 'POST', path: '/api/sentinel/composio-github-workflows' },
    actions: [{
      id: 'list-workflow-runs',
      capability: 'github.workflow-read',
      effect: 'read',
      risk: 'medium',
      approval: 'none',
      requiredScopes: ['github:workflow:read'],
    }],
    data: {
      classification: 'confidential',
      reads: ['GitHub Actions workflow run status, conclusion, branch, commit SHA and run URL'],
      writes: [],
    },
    network: { egressHosts: ['backend.composio.dev'] },
    auth: { mode: 'secret-reference', secretRef: 'secret://connections/composio-github-readonly' },
    limits: { requestsPerMinute: 20, timeoutMs: 8000, maxRequestBytes: 2048 },
    provenance: { sourceUrl: SOURCE_URL, revision: SOURCE_REVISION },
    licence: { identifier: 'first-party', review: 'not-applicable' },
    status: 'approved',
  },

  {
    id: 'aegis-composio-github-workflow-jobs-readonly',
    version: '0.1.0',
    name: 'Composio GitHub workflow job summaries',
    description: 'Read at most twenty job and step summaries for one exact workflow run without downloading logs or artifacts.',
    provider: { id: 'composio', kind: 'external' },
    interface: { kind: 'internal', method: 'POST', path: '/api/sentinel/composio-github-workflow-jobs' },
    actions: [{
      id: 'list-workflow-jobs',
      capability: 'github.workflow-jobs-read',
      effect: 'read',
      risk: 'medium',
      approval: 'none',
      requiredScopes: ['github:workflow-jobs:read'],
    }],
    data: {
      classification: 'confidential',
      reads: ['GitHub Actions job status, conclusion, commit, branch and bounded step summaries'],
      writes: [],
    },
    network: { egressHosts: ['backend.composio.dev'] },
    auth: { mode: 'secret-reference', secretRef: 'secret://connections/composio-github-readonly' },
    limits: { requestsPerMinute: 20, timeoutMs: 8000, maxRequestBytes: 2048 },
    provenance: { sourceUrl: SOURCE_URL, revision: SOURCE_REVISION },
    licence: { identifier: 'first-party', review: 'not-applicable' },
    status: 'approved',
  },
  {
    id: 'aegis-agent-run',
    version: '0.1.0',
    name: 'AEGIS agent plan execution authorisation',
    description: 'Authorise a single immutable agent plan for a future Sentinel-mediated execution; this capability does not execute specialists or tools itself.',
    provider: { id: 'aegis-core', kind: 'builtin' },
    interface: { kind: 'internal', method: 'POST', path: '/api/sentinel/agent-run-approval' },
    actions: [{
      id: 'approve-execution',
      capability: 'agent-run.approve-execution',
      effect: 'execute',
      risk: 'critical',
      approval: 'human-always',
      requiredScopes: ['aegis:agent-run:execute'],
    }],
    data: {
      classification: 'restricted',
      reads: ['immutable agent plan digest and owner approval state'],
      writes: ['agent-run execution authorisation state'],
    },
    network: { egressHosts: [] },
    auth: { mode: 'session' },
    limits: { requestsPerMinute: 5, timeoutMs: 5000, maxRequestBytes: 4096 },
    provenance: { sourceUrl: SOURCE_URL, revision: SOURCE_REVISION },
    licence: { identifier: 'first-party', review: 'not-applicable' },
    status: 'approved',
  },
];

for (const manifest of CAPABILITY_MANIFESTS) validateCapabilityManifest(manifest);
if (new Set(CAPABILITY_MANIFESTS.map((manifest) => manifest.id)).size !== CAPABILITY_MANIFESTS.length) {
  throw new Error('Duplicate capability manifest identifier');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function listCapabilityManifests() {
  return CAPABILITY_MANIFESTS.map(clone);
}

export function getCapabilityManifest(id) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null;
  const manifest = CAPABILITY_MANIFESTS.find((entry) => entry.id === id);
  return manifest ? clone(manifest) : null;
}

export function isCapabilityGranted(_manifestId, _capability) {
  // A manifest describes a capability; it never creates a permission grant.
  return false;
}
