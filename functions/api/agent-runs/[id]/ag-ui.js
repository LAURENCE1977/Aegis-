import { createAgentRunAgUiHandlers } from '../../../lib/agent-run-pages-routes.mjs';

const handlers = createAgentRunAgUiHandlers();
export const onRequestGet = handlers.onRequestGet;
