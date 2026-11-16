import { createAgentRunEventsHandlers } from '../../../../lib/agent-run-pages-routes.mjs';

const handlers = createAgentRunEventsHandlers();
export const onRequestGet = handlers.onRequestGet;
