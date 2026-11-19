import { authConfigAvailable, isAuthorized, isSameOriginRequest } from "../../../../lib/auth.mjs";
import { readBoundedText } from "../../../../lib/request-body.mjs";
import { linkForgeCandidateProvenance } from "../../../../lib/forge-provenance.mjs";

const OWNER_ID = "owner";
const MAX_BODY_BYTES = 2048;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

export async function onRequestPost({ request, env, params }) {
  if (!authConfigAvailable(env)) return json({ error: "Authentication is not configured." }, 503);
  if (!(await isAuthorized(request, env))) return json({ error: "Authentication required." }, 401);
  if (!isSameOriginRequest(request)) return json({ error: "Cross-origin request rejected." }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return json({ error: "Forge candidate storage is not configured." }, 503);
  }
  const candidateId = params?.id;
  if (typeof candidateId !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidateId)) {
    return json({ error: "Forge candidate not found." }, 404);
  }
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
    return json({ error: "Content-Type must be application/json." }, 415);
  }
  let raw;
  try { raw = await readBoundedText(request, MAX_BODY_BYTES); }
  catch (error) { return json({ error: error.message }, error.status || 400); }
  let body;
  try { body = JSON.parse(raw); }
  catch { return json({ error: "Request body must contain valid JSON." }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).length !== 1 || typeof body.provenanceId !== "string") {
    return json({ error: "Provide exactly one provenanceId field." }, 400);
  }
  try {
    const link = await linkForgeCandidateProvenance(env.AEGIS_DB, OWNER_ID, candidateId, body.provenanceId);
    return json({ link }, 201);
  } catch (error) {
    if (error instanceof TypeError) {
      const status = /not found/i.test(error.message) ? 404 : 400;
      return json({ error: error.message }, status);
    }
    return json({ error: "Forge provenance link could not be saved." }, 503);
  }
}
