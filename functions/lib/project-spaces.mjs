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

export async function createWorkspace(db, ownerId, input, now = Date.now()) {
  assertDatabase(db);
  requiredId(ownerId, 'owner identifier');
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Workspace details are required');
  }
  const name = boundedText(input.name, 'name', 80, { required: true });
  const description = boundedText(input.description ?? '', 'description', 500);
  const timestamp = validClock(now);
  const id = crypto.randomUUID();

  await db.prepare(`
    INSERT INTO project_spaces (
      id, owner_id, name, description, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'active', ?, ?)
  `).bind(id, ownerId, name, description, timestamp, timestamp).run();

  return {
    id, ownerId, name, description, status: 'active',
    createdAt: timestamp, updatedAt: timestamp,
  };
}

export async function listWorkspaces(db, ownerId, limit = 50) {
  assertDatabase(db);
  requiredId(ownerId, 'owner identifier');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError('Workspace list limit must be between 1 and 100');
  }
  const result = await db.prepare(`
    SELECT * FROM project_spaces
    WHERE owner_id = ? AND status = 'active'
    ORDER BY updated_at DESC
    LIMIT ?
  `).bind(ownerId, limit).all();
  return (result?.results || []).map(mapWorkspace);
}

export async function getWorkspace(db, ownerId, workspaceId) {
  assertDatabase(db);
  requiredId(ownerId, 'owner identifier');
  requiredId(workspaceId, 'identifier');
  const row = await db.prepare(`
    SELECT * FROM project_spaces WHERE id = ? AND owner_id = ? LIMIT 1
  `).bind(workspaceId, ownerId).first();
  return mapWorkspace(row);
}

export async function appendWorkspaceEvent(db, {
  ownerId, workspaceId, type, summary, content,
} = {}, now = Date.now()) {
  assertDatabase(db);
  requiredId(ownerId, 'owner identifier');
  requiredId(workspaceId, 'identifier');
  if (!EVENT_TYPES.has(type)) throw new TypeError('Unsupported workspace event type');
  const safeSummary = boundedText(summary, 'event summary', 240, { required: true });
  const safeContent = boundedText(content, 'event content', 12_000, { required: true });
  const timestamp = validClock(now);
  const workspace = await getWorkspace(db, ownerId, workspaceId);
  if (!workspace || workspace.status !== 'active') return null;

  const id = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO project_space_events (
      id, space_id, owner_id, event_type, summary, content, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, workspaceId, ownerId, type, safeSummary, safeContent, timestamp).run();

  await db.prepare(`
    UPDATE project_spaces SET updated_at = ?
    WHERE id = ? AND owner_id = ? AND status = 'active'
  `).bind(timestamp, workspaceId, ownerId).run();

  return {
    id, workspaceId, ownerId, type, summary: safeSummary,
    content: safeContent, createdAt: timestamp,
  };
}

export async function listWorkspaceEvents(db, ownerId, workspaceId, limit = 50) {
  assertDatabase(db);
  requiredId(ownerId, 'owner identifier');
  requiredId(workspaceId, 'identifier');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError('Workspace event limit must be between 1 and 100');
  }
  const workspace = await getWorkspace(db, ownerId, workspaceId);
  if (!workspace) return null;
  const result = await db.prepare(`
    SELECT * FROM project_space_events
    WHERE owner_id = ? AND space_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(ownerId, workspaceId, limit).all();
  return (result?.results || []).map(mapEvent);
}
