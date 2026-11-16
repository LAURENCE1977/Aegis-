import { createAgentRunDetailHandlers } from '../../../lib/agent-run-pages-routes.mjs';

const handlers = createAgentRunDetailHandlers();
export const onRequestGet = handlers.onRequestGet;
