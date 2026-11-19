import { createAgentRunApprovalAuthorizationHandlers } from '../../../../lib/agent-run-approval-routes.mjs';

const handlers = createAgentRunApprovalAuthorizationHandlers();
export const onRequestPost = handlers.onRequestPost;
