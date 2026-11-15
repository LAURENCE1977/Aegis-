import { authConfigAvailable, isAuthorized, isSameOriginRequest } from "../../../lib/auth.mjs";
import { readBoundedText } from "../../../lib/request-body.mjs";
import { ForgeCandidateConflictError, updateForgeCandidateReview } from "../../../lib/forge-candidates.mjs";

const OWNER_ID = "owner";
const MAX_BODY_BYTES = 4096;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

export async function onRequestPatch({ request, env, params }) {
  if (!authConfigAvailable(env)) return json({ error: "Authentication is not configured." }, 503);
  if (!(await isAuthorized(request, env))) return json({ error: "Authentication required." }, 401);
  if (!isSameOriginRequest(request)) return json({ error: "Cross-origin request rejected." }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return json({ error: "Forge candidate storage is not configured." }, 503);
  }
  const id = params?.id;
  if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    return json({ error: "Forge candidate not found." }, 404);
  }
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
    return json({ error: "Content-Type must be application/json." }, 415);
  }
  let raw;
  try { raw = await readBoundedText(request, MAX_BODY_BYTES); }
  catch (error) { return json({ error: error.message }, error.status || 400); }
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: "Request body must contain valid JSON." }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).length !== 7 ||
      !Object.hasOwn(body, "licenceReview") ||
      !Object.hasOwn(body, "decision") ||
      !Object.hasOwn(body, "status") ||
      !Object.hasOwn(body, "licenceEvidenceUrl") ||
      !Object.hasOwn(body, "reviewNote") ||
      !Object.hasOwn(body, "licenceAttested") ||
      !Object.hasOwn(body, "expectedUpdatedAt")) {
    return json({ error: "Provide licence review, evidence, attestation, decision, status and expectedUpdatedAt." }, 400);
  }

  try {
    const candidate = await updateForgeCandidateReview(env.AEGIS_DB, OWNER_ID, id, body);
    if (!candidate) return json({ error: "Forge candidate not found or is terminal." }, 404);
    return json({ candidate });
  } catch (error) {
    if (error instanceof TypeError) return json({ error: error.message }, 400);
    if (error instanceof ForgeCandidateConflictError) return json({ error: error.message }, 409);
    return json({ error: "Forge candidate review could not be saved." }, 503);
  }
}
