import { getWorkspace, listWorkspaceEvents } from './project-spaces.mjs';
import { createMemoryRepository } from './memory-substrate.mjs';
import { buildProjectBrief } from './project-brief.mjs';
import { digestProjectBrief } from './project-context-digest.mjs';
import { digestCanonicalInput } from './canonical-input.mjs';
import { listForgeKnowledgeRecords } from './forge-knowledge.mjs';
import { rankKnowledgeChunks } from './knowledge-retrieval.mjs';

const OWNER_ID = 'owner';
const PROJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_CONTEXT_CHARS = 6000;
const MAX_BRIEF_BYTES = 7 * 1024;
const MAX_KNOWLEDGE_BYTES = 4 * 1024;
const MAX_CONTEXT_BYTES = 12 * 1024 - 128;

function buildAcceptedKnowledgeContext(records, objective = '') {
  const eligible = (Array.isArray(records) ? records : []).filter((record) =>
    record && record.ownerId === OWNER_ID && record.status === 'accepted' &&
    ['high', 'medium'].includes(record.evidenceLevel) &&
    Array.isArray(record.sources) && record.sources.length > 0
  );
  const rankedIds = objective.trim()
    ? rankKnowledgeChunks(objective.slice(0, 500), eligible.map((record) => {
      const text = [record.title, record.domain, record.knowledgeType, record.summary,
        ...(record.limitations || []), ...(record.applicableCapabilities || [])].join(' ');
      return { id: record.id, text, sourceId: record.id, startOffset: 0, endOffset: text.length, status: 'accepted' };
    }), { limit: 5 }).map((item) => item.id)
    : eligible.slice(0, 5).map((record) => record.id);
  const byId = new Map(eligible.map((record) => [record.id, record]));
  const selected = [];
  for (const id of rankedIds) {
    const record = byId.get(id);
    if (!record) continue;
    const candidate = {
      id: record.id,
      title: record.title.slice(0, 160),
      domain: record.domain,
      knowledgeType: record.knowledgeType,
      summary: record.summary.slice(0, 500),
      evidenceLevel: record.evidenceLevel,
      sources: record.sources.slice(0, 1).map((source) => ({
        url: source.url,
        title: source.title.slice(0, 120),
        attribution: source.attribution.slice(0, 120),
      })),
      limitations: record.limitations.slice(0, 3).map((item) => item.slice(0, 200)),
      applicableCapabilities: record.applicableCapabilities.slice(0, 6),
      version: record.version,
      updatedAt: record.updatedAt,
      trust: 'untrusted-reference',
    };
    const next = [...selected, candidate];
    if (new TextEncoder().encode(JSON.stringify(next)).byteLength > MAX_KNOWLEDGE_BYTES) break;
    selected.push(candidate);
  }
  return selected;
}

export function createAgentRunProjectContextBuilder({
  getWorkspace: getWorkspaceImpl = getWorkspace,
  listWorkspaceEvents: listWorkspaceEventsImpl = listWorkspaceEvents,
  createMemoryRepository: createMemoryRepositoryImpl = createMemoryRepository,
  buildProjectBrief: buildProjectBriefImpl = buildProjectBrief,
  digestProjectBrief: digestProjectBriefImpl = digestProjectBrief,
  listForgeKnowledgeRecords: listForgeKnowledgeRecordsImpl = listForgeKnowledgeRecords,
} = {}) {
  return async function buildAgentRunProjectContext(db, projectId, now = Date.now(), objective = '') {
    if (!db || typeof db.prepare !== 'function') {
      throw new TypeError('Project Space database is required');
    }
    if (typeof projectId !== 'string' || !PROJECT_ID_PATTERN.test(projectId)) {
      throw new TypeError('Invalid Project Space identifier');
    }
    if (!Number.isFinite(now)) throw new TypeError('Invalid Project Space context clock');
    if (typeof objective !== 'string' || objective.length > 2000 ||
        /[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/.test(objective)) {
      throw new TypeError('Invalid agent objective for knowledge retrieval');
    }

    const workspace = await getWorkspaceImpl(db, OWNER_ID, projectId);
    if (!workspace || workspace.id !== projectId || workspace.ownerId !== OWNER_ID || workspace.status !== 'active') return null;

    const [events, memories, knowledgeRecords] = await Promise.all([
      listWorkspaceEventsImpl(db, OWNER_ID, projectId, 100),
      createMemoryRepositoryImpl(db).list({
        ownerId: OWNER_ID,
        projectId,
        limit: 50,
        now,
      }),
      listForgeKnowledgeRecordsImpl(db, OWNER_ID, { status: 'accepted', limit: 100 }),
    ]);
    if (!events) return null;

    let maxChars = MAX_CONTEXT_CHARS;
    let brief = buildProjectBriefImpl({ workspace, events, memories, maxChars, now });
    while (new TextEncoder().encode(JSON.stringify(brief)).byteLength > MAX_BRIEF_BYTES &&
        maxChars > 1000) {
      maxChars = Math.max(1000, Math.floor(maxChars * 0.75));
      brief = buildProjectBriefImpl({ workspace, events, memories, maxChars, now });
    }
    const digest = await digestProjectBriefImpl(brief);
    const knowledge = buildAcceptedKnowledgeContext(knowledgeRecords, objective || brief.goal);
    const knowledgeDigest = await digestCanonicalInput(knowledge);
    const context = { brief, digest, knowledge, knowledgeDigest };
    if (new TextEncoder().encode(JSON.stringify(context)).byteLength > MAX_CONTEXT_BYTES) {
      throw new RangeError('Project Space context exceeds the byte budget');
    }
    return context;
  };
}

export const buildAgentRunProjectContext = createAgentRunProjectContextBuilder();
