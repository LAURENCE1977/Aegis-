import { getWorkspace, listWorkspaceEvents } from './project-spaces.mjs';
import { createMemoryRepository } from './memory-substrate.mjs';
import { buildProjectBrief } from './project-brief.mjs';
import { digestProjectBrief } from './project-context-digest.mjs';

const OWNER_ID = 'owner';
const PROJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_CONTEXT_CHARS = 6000;

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
    if (!workspace || workspace.status !== 'active') return null;

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

    const brief = buildProjectBriefImpl({
      workspace,
      events,
      memories,
      maxChars: MAX_CONTEXT_CHARS,
      now,
    });
    const digest = await digestProjectBriefImpl(brief);
    return { brief, digest };
  };
}

export const buildAgentRunProjectContext = createAgentRunProjectContextBuilder();
