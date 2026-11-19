import {
  authorizeOwnerOrReviewer,
  authorizeReviewer,
  isOwnerWriteRequest,
  jsonResponse,
  readJsonRequest,
} from "../lib/owner-api.mjs";
import {
  decideApprovalRequest,
  listPendingApprovals,
} from "../lib/capability-approvals.mjs";

const REVIEWER_ID = "reviewer";

function publicApproval(approval, now = Date.now()) {
  return {
    id: approval.id,
    capabilityId: approval.capabilityId,
    capabilityVersion: approval.capabilityVersion,
    actionId: approval.actionId,
    resourceId: approval.resourceId,
    operationSummary: approval.operationSummary,
    requestedBy: approval.requestedBy,
    requestedAt: approval.requestedAt,
    expiresAt: approval.expiresAt,
    status: approval.status,
    decidedBy: approval.decidedBy,
    expired: Date.parse(approval.expiresAt) <= now,
    decidedAt: approval.decidedAt,
  };
}

export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwnerOrReviewer(request, env);
  if (denied) return denied;
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return jsonResponse({ error: "Approval storage is not configured." }, 503);
  }

  try {
    const approvals = await listPendingApprovals(env.AEGIS_DB, 50);
    const now = Date.now();
    return jsonResponse({
      approvals: approvals.map((approval) => publicApproval(approval, now)),
      total: approvals.length,
    });
  } catch {
    return jsonResponse({ error: "Approval inbox is temporarily unavailable." }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  const denied = await authorizeReviewer(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) {
    return jsonResponse({ error: "Invalid request origin." }, 403);
  }
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return jsonResponse({ error: "Approval storage is not configured." }, 503);
  }

  const parsed = await readJsonRequest(request, 2048);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some((key) => !["id", "decision"].includes(key)) ||
      typeof body.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(body.id) ||
      !["approved", "denied"].includes(body.decision)) {
    return jsonResponse({ error: "A request ID and approved/denied decision are required." }, 400);
  }

  try {
    const approval = await decideApprovalRequest(env.AEGIS_DB, {
      id: body.id,
      decision: body.decision,
      decidedBy: REVIEWER_ID,
    });
    if (!approval) {
      return jsonResponse({ error: "Approval is no longer pending or has expired." }, 409);
    }
    return jsonResponse({ approval: publicApproval(approval) });
  } catch {
    return jsonResponse({ error: "Approval decision could not be saved." }, 503);
  }
}
