import { authConfigAvailable, isAuthorized, isSameOriginRequest } from "../../lib/auth.mjs";
import { readBoundedText } from "../../lib/request-body.mjs";
import { inspectGitHubRepository, GitHubSourceError } from "../../lib/github-discovery.mjs";
import { createForgeCandidate, listForgeCandidates } from "../../lib/forge-candidates.mjs";

const OWNER_ID = "owner";
const MAX_BODY_BYTES = 4096;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

export async function onRequestGet({ request, env }) {
  if (!authConfigAvailable(env)) return json({ error: "Authentication is not configured." }, 503);
  if (!(await isAuthorized(request, env))) return json({ error: "Authentication required." }, 401);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return json({ error: "Forge candidate storage is not configured." }, 503);
  }
  const rawLimit = new URL(request.url).searchParams.get("limit");
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return json({ error: "Candidate limit must be between 1 and 100." }, 400);
  try {
    const candidates = await listForgeCandidates(env.AEGIS_DB, OWNER_ID, limit);
    return json({ candidates, total: candidates.length });
  } catch {
    return json({ error: "Forge candidate list is temporarily unavailable." }, 503);
  }
}

export async function onRequestPost({ request, env, fetchImpl = fetch }) {
  if (!authConfigAvailable(env)) return json({ error: "Authentication is not configured." }, 503);
  if (!(await isAuthorized(request, env))) return json({ error: "Authentication required." }, 401);
  if (!isSameOriginRequest(request)) return json({ error: "Cross-origin request rejected." }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return json({ error: "Forge candidate storage is not configured." }, 503);
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
      Object.keys(body).length !== 1 || typeof body.sourceUrl !== "string") {
    return json({ error: "Provide exactly one sourceUrl field." }, 400);
  }

  try {
    const repository = await inspectGitHubRepository(body.sourceUrl, fetchImpl);
    const result = await createForgeCandidate(env.AEGIS_DB, OWNER_ID, repository);
    return json({
      candidate: result.candidate,
      created: result.created,
      licenceReviewRequired: result.candidate.licence.review === "review-required",
    }, result.created ? 201 : 200);
  } catch (error) {
    if (error instanceof TypeError) return json({ error: error.message }, 400);
    if (error instanceof GitHubSourceError) return json({ error: error.message }, error.status);
    return json({ error: "Forge candidate could not be saved." }, 503);
  }
}
