const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const EVENT_TYPES = new Set([
  'note',
  'decision',
  'research',
  'task',
  'agent_handoff',
  'agent_result',
  'feedback',
]);
const encoder = new TextEncoder();

function requiredId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new TypeError('Invalid workspace ' + label);
  }
}

function boundedText(value, label, maxBytes, { required = false } = {}) {
  if (typeof value !== 'string') {
    if (required) throw new TypeError('Invalid workspace ' + label);
    return '';
  }
  const normalized = value.trim();
  const size = encoder.encode(normalized).byteLength;
  if ((required && size === 0) || size > maxBytes) {
    throw new TypeError('Invalid workspace ' + label);
  }
  return normalized;
}

function mapWorkspace(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerId: row.owner_id,
    principalId: row.principal_id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.space_id,
    ownerId: row.owner_id,
    principalId: row.principal_id,
    tenantId: row.tenant_id,
    type: row.event_type,
    summary: row.summary,
    content: row.content,
    createdAt: row.created_at,
  };
}

function validClock(now) {
  if (!Number.isFinite(now)) throw new TypeError('Invalid workspace clock');
  return new Date(now).toISOString();
}

function assertDatabase(db) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('Workspace database is required');
  }
}

export async function createWorkspace(db, principal, input, now = Date.now()) {
  assertDatabase(db);
  const { principalId, tenantId } = principal || {};
  requiredId(principalId, 'principal identifier');
  requiredId(tenantId, 'tenant identifier');
  const ownerId = principalId;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Workspace details are required');
  }
  const name = boundedText(input.name, 'name', 80, { required: true });
  const description = boundedText(input.description ?? '', 'description', 500);
  const timestamp = validClock(now);
  const id = crypto.randomUUID();

  await db.prepare(`
    INSERT INTO project_spaces (
      id, owner_id, principal_id, tenant_id, name, description, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `).bind(id, ownerId, principalId, tenantId, name, description, timestamp, timestamp).run();

  return {
    id, ownerId, principalId, tenantId, name, description, status: 'active',
    createdAt: timestamp, updatedAt: timestamp,
  };
}

export async function listWorkspaces(db, principal, limit = 50) {
  assertDatabase(db);
  const { principalId, tenantId } = principal || {};
  requiredId(principalId, 'principal identifier');
  requiredId(tenantId, 'tenant identifier');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError('Workspace list limit must be between 1 and 100');
  }
  const result = await db.prepare(`
    SELECT * FROM project_spaces
    WHERE tenant_id = ? AND principal_id = ? AND status = 'active'
    ORDER BY updated_at DESC
    LIMIT ?
  `).bind(tenantId, principalId, limit).all();
  return (result?.results || []).map(mapWorkspace);
}

export async function getWorkspace(db, principal, workspaceId) {
  assertDatabase(db);
  const { principalId, tenantId } = principal || {};
  requiredId(principalId, 'principal identifier');
  requiredId(tenantId, 'tenant identifier');
  requiredId(workspaceId, 'identifier');
  const row = await db.prepare(`
    SELECT * FROM project_spaces WHERE id = ? AND tenant_id = ? AND principal_id = ? LIMIT 1
  `).bind(workspaceId, tenantId, principalId).first();
  return mapWorkspace(row);
}

export async function appendWorkspaceEvent(db, {
  principal, workspaceId, type, summary, content,
} = {}, now = Date.now()) {
  assertDatabase(db);
  const { principalId, tenantId } = principal || {};
  requiredId(principalId, 'principal identifier');
  requiredId(tenantId, 'tenant identifier');
  const ownerId = principalId;
  requiredId(workspaceId, 'identifier');
  if (!EVENT_TYPES.has(type)) throw new TypeError('Unsupported workspace event type');
  const safeSummary = boundedText(summary, 'event summary', 240, { required: true });
  const safeContent = boundedText(content, 'event content', 12_000, { required: true });
  const timestamp = validClock(now);
  const workspace = await getWorkspace(db, principal, workspaceId);
  if (!workspace || workspace.status !== 'active') return null;

  const ownerId = workspace.ownerId;
  const id = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO project_space_events (
      id, space_id, owner_id, principal_id, tenant_id, event_type, summary, content, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, workspaceId, ownerId, principalId, tenantId, type, safeSummary, safeContent, timestamp).run();

  await db.prepare(`
    UPDATE project_spaces SET updated_at = ?
    WHERE id = ? AND tenant_id = ? AND principal_id = ? AND status = 'active'
  `).bind(timestamp, workspaceId, tenantId, principalId).run();

  return {
    id, workspaceId, ownerId, principalId, tenantId, type, summary: safeSummary,
    content: safeContent, createdAt: timestamp,
  };
}

export async function listWorkspaceEvents(db, principal, workspaceId, limit = 50) {
  assertDatabase(db);
  const { principalId, tenantId } = principal || {};
  requiredId(principalId, 'principal identifier');
  requiredId(tenantId, 'tenant identifier');
  requiredId(workspaceId, 'identifier');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError('Workspace event limit must be between 1 and 100');
  }
  const workspace = await getWorkspace(db, ownerId, workspaceId);
  if (!workspace) return null;
  const result = await db.prepare(`
    SELECT * FROM project_space_events
    WHERE tenant_id = ? AND principal_id = ? AND space_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(tenantId, principalId, workspaceId, limit).all();
  return (result?.results || []).map(mapEvent);
}
