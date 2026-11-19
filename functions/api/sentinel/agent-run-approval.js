import { createAgentRunApprovalHandlers } from '../../lib/agent-run-approval-routes.mjs';

const handlers = createAgentRunApprovalHandlers();
export const onRequestGet = handlers.onRequestGet;
export const onRequestPost = handlers.onRequestPost;
