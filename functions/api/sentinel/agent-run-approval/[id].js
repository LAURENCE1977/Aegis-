import { createAgentRunApprovalDecisionHandlers } from '../../../lib/agent-run-approval-routes.mjs';

const handlers = createAgentRunApprovalDecisionHandlers();
export const onRequestPatch = handlers.onRequestPatch;
