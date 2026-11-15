const MODULES = [
  {
    id: 'forge',
    name: 'AEGIS Forge',
    description: 'Controlled software engineering, code analysis and agent-assisted development.',
    status: 'planned',
    capabilities: [
      'code.read', 'code.analyse', 'code.propose', 'code.test',
      'source.discover', 'source.inspect', 'source.compare',
      'candidate.evaluate', 'blueprint.create', 'implementation.plan', 'benchmark.compare',
    ],
    permissions: [],
  },
  {
    id: 'engineering-intelligence',
    name: 'AEGIS Engineering Intelligence',
    description: 'Curated, source-attributed engineering knowledge transformed into tested AEGIS capabilities.',
    status: 'planned',
    capabilities: ['knowledge.ingest', 'knowledge.search', 'knowledge.evaluate', 'knowledge.adapt'],
    permissions: [],
  },
  {
    id: 'research',
    name: 'AEGIS Research',
    description: 'Source-aware web research, extraction and knowledge preparation.',
    status: 'planned',
    capabilities: ['research.search', 'research.fetch', 'research.extract'],
    permissions: [],
  },
  {
    id: 'media-studio',
    name: 'AEGIS Media Studio',
    description: 'Optional image, audio and video production workflows.',
    status: 'planned',
    capabilities: ['media.image', 'media.audio', 'media.video'],
    permissions: [],
  },
  {
    id: 'connections',
    name: 'AEGIS Connections',
    description: 'Explicitly authorised integrations with external services.',
    status: 'planned',
    capabilities: ['connections.discover', 'connections.read', 'connections.write'],
    permissions: [],
  },
];

const ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const CAPABILITY_PATTERN = /^[a-z][a-z0-9-]{0,31}\.[a-z][a-z0-9-]{0,47}$/;

export function validateModule(module) {
  if (!module || typeof module !== 'object' || Array.isArray(module)) {
    throw new TypeError('Module must be an object');
  }
  if (typeof module.id !== 'string' || !ID_PATTERN.test(module.id)) {
    throw new TypeError('Invalid module identifier');
  }
  if (typeof module.name !== 'string' || !module.name.trim() || module.name.length > 100) {
    throw new TypeError('Invalid module name');
  }
  if (!['available', 'planned'].includes(module.status)) {
    throw new TypeError('Invalid module status');
  }
  if (!Array.isArray(module.capabilities) ||
      module.capabilities.some((capability) => typeof capability !== 'string' || !CAPABILITY_PATTERN.test(capability)) ||
      new Set(module.capabilities).size !== module.capabilities.length) {
    throw new TypeError('Invalid module capabilities');
  }
  // Registry metadata can declare capabilities, but cannot grant permissions.
  if (!Array.isArray(module.permissions) || module.permissions.length !== 0) {
    throw new TypeError('Module permissions must be empty; grants require a separate approval system');
  }
  if (module.description !== undefined &&
      (typeof module.description !== 'string' || module.description.length > 500)) {
    throw new TypeError('Invalid module description');
  }
  return true;
}

for (const module of MODULES) validateModule(module);
if (new Set(MODULES.map((module) => module.id)).size !== MODULES.length) {
  throw new Error('Duplicate module identifier in registry');
}

export function listModules() {
  return MODULES.map((module) => ({
    ...module,
    capabilities: [...module.capabilities],
    permissions: [],
  }));
}

export function getModule(id) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null;
  const module = MODULES.find((entry) => entry.id === id);
  return module ? {
    ...module,
    capabilities: [...module.capabilities],
    permissions: [],
  } : null;
}

export function hasCapability(moduleId, capability) {
  const module = getModule(moduleId);
  return Boolean(module && typeof capability === 'string' && module.capabilities.includes(capability));
}

export function isCapabilityAllowed(moduleId, capability) {
  // Deliberately fail closed. Capability declarations are descriptive only;
  // a future grant system must be separate, explicit, auditable and user-approved.
  return false;
}
