import {
  authConfigAvailable,
  isAuthorized,
  isSameOriginRequest,
} from "../lib/auth.mjs";
import {
  decideApprovalRequest,
  listPendingApprovals,
} from "../lib/capability-approvals.mjs";

const MAX_BODY_BYTES = 2048;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  },
});

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
    expired: Date.parse(approval.expiresAt) <= now,
    decidedAt: approval.decidedAt,
  };
}

async function authorize(request, env) {
  if (!authConfigAvailable(env)) {
    return json({ error: "Authentication is not configured." }, 503);
  }
  if (!(await isAuthorized(request, env))) {
    return json({ error: "Authentication required." }, 401);
  }
  return null;
}

export async function onRequestGet({ request, env }) {
  const denied = await authorize(request, env);
  if (denied) return denied;
  if (!env.APPROVALS || typeof env.APPROVALS.prepare !== "function") {
    return json({ error: "Approval storage is not configured." }, 503);
  }

  try {
    const approvals = await listPendingApprovals(env.APPROVALS, 50);
    const now = Date.now();
    return json({
      approvals: approvals.map((approval) => publicApproval(approval, now)),
      total: approvals.length,
    });
  } catch {
    return json({ error: "Approval inbox is temporarily unavailable." }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  const denied = await authorize(request, env);
  if (denied) return denied;
  if (!isSameOriginRequest(request)) {
    return json({ error: "Invalid request origin." }, 403);
  }
  if (!env.APPROVALS || typeof env.APPROVALS.prepare !== "function") {
    return json({ error: "Approval storage is not configured." }, 503);
  }
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
    return json({ error: "JSON content type required." }, 415);
  }

  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return json({ error: "Request body is too large." }, 413);
  }

  let raw;
  try {
    raw = await request.text();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return json({ error: "Request body is too large." }, 413);
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON request." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some((key) => !["id", "decision"].includes(key)) ||
      typeof body.id !== "string" || !["approved", "denied"].includes(body.decision)) {
    return json({ error: "A request ID and approved/denied decision are required." }, 400);
  }

  try {
    // This is a single-owner deployment. The authenticated session is the owner;
    // never accept the decision actor or operation binding from the browser.
    const approval = await decideApprovalRequest(env.APPROVALS, {
      id: body.id,
      decision: body.decision,
      decidedBy: "owner",
    });
    if (!approval) {
      return json({ error: "Approval is no longer pending or has expired." }, 409);
    }
    return json({ approval: publicApproval(approval) });
  } catch {
    return json({ error: "Approval decision could not be saved." }, 503);
  }
}
