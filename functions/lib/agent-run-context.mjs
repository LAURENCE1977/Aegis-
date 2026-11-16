import { getWorkspace, listWorkspaceEvents } from './project-spaces.mjs';
import { createMemoryRepository } from './memory-substrate.mjs';
import { buildProjectBrief } from './project-brief.mjs';
import { digestProjectBrief } from './project-context-digest.mjs';

const OWNER_ID = 'owner';
const PROJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_CONTEXT_CHARS = 6000;
const MAX_CONTEXT_BYTES = 11 * 1024;

export function createAgentRunProjectContextBuilder({
  getWorkspace: getWorkspaceImpl = getWorkspace,
  listWorkspaceEvents: listWorkspaceEventsImpl = listWorkspaceEvents,
  createMemoryRepository: createMemoryRepositoryImpl = createMemoryRepository,
  buildProjectBrief: buildProjectBriefImpl = buildProjectBrief,
  digestProjectBrief: digestProjectBriefImpl = digestProjectBrief,
} = {}) {
  return async function buildAgentRunProjectContext(db, projectId, now = Date.now()) {
    if (!db || typeof db.prepare !== 'function') {
      throw new TypeError('Project Space database is required');
    }
    if (typeof projectId !== 'string' || !PROJECT_ID_PATTERN.test(projectId)) {
      throw new TypeError('Invalid Project Space identifier');
    }
    if (!Number.isFinite(now)) throw new TypeError('Invalid Project Space context clock');

    const workspace = await getWorkspaceImpl(db, OWNER_ID, projectId);
    if (!workspace || workspace.id !== projectId || workspace.ownerId !== OWNER_ID || workspace.status !== 'active') return null;

    const [events, memories] = await Promise.all([
      listWorkspaceEventsImpl(db, OWNER_ID, projectId, 100),
      createMemoryRepositoryImpl(db).list({
        ownerId: OWNER_ID,
        projectId,
        limit: 50,
        now,
      }),
    ]);
    if (!events) return null;

    let maxChars = MAX_CONTEXT_CHARS;
    let brief = buildProjectBriefImpl({ workspace, events, memories, maxChars, now });
    while (new TextEncoder().encode(JSON.stringify(brief)).byteLength > MAX_CONTEXT_BYTES &&
        maxChars > 1000) {
      maxChars = Math.max(1000, Math.floor(maxChars * 0.75));
      brief = buildProjectBriefImpl({ workspace, events, memories, maxChars, now });
    }
    const digest = await digestProjectBriefImpl(brief);
    const context = { brief, digest };
    if (new TextEncoder().encode(JSON.stringify(context)).byteLength > MAX_CONTEXT_BYTES + 128) {
      throw new RangeError('Project Space context exceeds the byte budget');
    }
    return context;
  };
}

export const buildAgentRunProjectContext = createAgentRunProjectContextBuilder();
