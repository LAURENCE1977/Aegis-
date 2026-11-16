import { createAgentRunCancelHandlers } from '../../../lib/agent-run-pages-routes.mjs';

const handlers = createAgentRunCancelHandlers();
export const onRequestPost = handlers.onRequestPost;
