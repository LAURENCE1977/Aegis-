const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REVISION_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;
const HOST_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const SCOPE_PATTERN = /^[a-z][a-z0-9-]{0,40}:[a-z][a-z0-9-]{0,50}(?::[a-z0-9._-]{1,80})?$/;
const TRANSPORTS = new Set(['stdio', 'streamable-http', 'sse']);
const RUNTIMES = new Set(['local-process', 'container', 'remote']);
const AUTH_MODES = new Set(['none', 'session', 'oauth2', 'api-key', 'secret-reference']);
const LICENCE_REVIEWS = new Set(['verified', 'review-required', 'unknown']);
const STATUSES = new Set(['candidate', 'reviewed', 'blocked']);
const EFFECTS = new Set(['read', 'write', 'execute']);
const RISKS = new Set(['low', 'medium', 'high', 'critical']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireText(value, label, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > max ||
      /[\\u0000-\\u001f\\u007f]/.test(value)) {
    throw new TypeError('Invalid MCP server ' + label);
  }
}

function requireHttpsUrl(value, label) {
  requireText(value, label, 2048);
  let url;
  try { url = new URL(value); } catch { throw new TypeError('Invalid MCP server ' + label); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password ||
      url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) {
    throw new TypeError('Invalid MCP server ' + label);
  }
}

function requireUniqueStrings(value, label, { max = 50, pattern } = {}) {
  if (!Array.isArray(value) || value.length > max) throw new TypeError('Invalid MCP server ' + label);
  for (const item of value) {
    requireText(item, label, 200);
    if (pattern && !pattern.test(item)) throw new TypeError('Invalid MCP server ' + label);
  }
  if (new Set(value).size !== value.length) throw new TypeError('Duplicate MCP server ' + label);
}

function validateAction(action) {
  if (!isRecord(action) || !ID_PATTERN.test(action.id ?? '')) {
    throw new TypeError('Invalid MCP server action');
  }
  requireText(action.description, 'action description', 500);
  if (!EFFECTS.has(action.effect) || !RISKS.has(action.risk)) {
    throw new TypeError('Invalid MCP server action effect or risk');
  }
  if (!['none', 'human-always'].includes(action.approvalPolicy)) {
    throw new TypeError('Invalid MCP server action approval policy');
  }
  if ((action.effect !== 'read' || action.risk === 'high' || action.risk === 'critical') &&
      action.approvalPolicy !== 'human-always') {
    throw new TypeError('Write, execute and high-risk MCP actions require human-always approval');
  }
  requireUniqueStrings(action.requiredScopes, 'action scopes', { pattern: SCOPE_PATTERN });
}

export function validateMcpServerRecord(record) {
  if (!isRecord(record)) throw new TypeError('MCP server record must be an object');
  if (!ID_PATTERN.test(record.id ?? '')) throw new TypeError('Invalid MCP server identifier');
  requireText(record.name, 'name', 160);
  requireText(record.description, 'description', 2000);
  requireHttpsUrl(record.sourceUrl, 'source URL');
  if (typeof record.revision !== 'string' || !REVISION_PATTERN.test(record.revision)) {
    throw new TypeError('MCP server revision must be a pinned commit SHA');
  }

  if (!isRecord(record.licence)) throw new TypeError('Invalid MCP server licence');
  requireText(record.licence.identifier, 'licence identifier', 100);
  if (!LICENCE_REVIEWS.has(record.licence.review)) throw new TypeError('Invalid MCP server licence review');

  if (!TRANSPORTS.has(record.transport)) throw new TypeError('Invalid MCP server transport');
  if (!RUNTIMES.has(record.runtime)) throw new TypeError('Invalid MCP server runtime');
  if (!AUTH_MODES.has(record.auth)) throw new TypeError('Invalid MCP server authentication mode');
  if (record.auth === 'secret-reference' && !/^secret:\/\/[A-Za-z0-9][A-Za-z0-9._/-]{2,120}$/.test(record.secretRef ?? '')) {
    throw new TypeError('MCP server secret reference must be an identifier, never a secret value');
  }
  if (record.auth !== 'secret-reference' && record.secretRef !== undefined) {
    throw new TypeError('Unexpected MCP server secret reference');
  }

  requireUniqueStrings(record.egressHosts, 'egress hosts', { pattern: HOST_PATTERN });
  if (!Array.isArray(record.actions) || record.actions.length < 1 || record.actions.length > 100) {
    throw new TypeError('Invalid MCP server actions');
  }
  const actionIds = new Set();
  for (const action of record.actions) {
    validateAction(action);
    if (actionIds.has(action.id)) throw new TypeError('Duplicate MCP server action identifier');
    actionIds.add(action.id);
  }
  if (!STATUSES.has(record.status)) {
    throw new TypeError('MCP server admission status must remain candidate, reviewed or blocked');
  }
  return true;
}

function clone(value) {
  return structuredClone(value);
}

export function createMcpServerCatalogue(records = []) {
  if (!Array.isArray(records) || records.length > 5000) {
    throw new TypeError('Invalid MCP server catalogue');
  }
  const byId = new Map();
  for (const record of records) {
    validateMcpServerRecord(record);
    if (byId.has(record.id)) throw new TypeError('Duplicate MCP server identifier');
    byId.set(record.id, clone(record));
  }

  return Object.freeze({
    list() {
      return [...byId.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(clone);
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
          record.id, record.name, record.description, record.sourceUrl,
          record.licence.identifier, record.transport, record.runtime,
          ...record.egressHosts,
          ...record.actions.flatMap((action) => [action.id, action.description, action.effect, action.risk, ...action.requiredScopes]),
        ].some((field) => field.toLocaleLowerCase().includes(needle)))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(clone);
    },
  });
}
