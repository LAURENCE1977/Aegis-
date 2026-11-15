import { authConfigAvailable, isAuthorized, isSameOriginRequest } from "../../lib/auth.mjs";
import { readGitHubBlob, GitHubSourceError } from "../../lib/github-discovery.mjs";

const MAX_BODY_BYTES = 4096;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

export async function onRequestPost({ request, env, fetchImpl = fetch }) {
  if (!authConfigAvailable(env)) return json({ error: "Authentication is not configured." }, 503);
  if (!(await isAuthorized(request, env))) return json({ error: "Authentication required." }, 401);
  if (!isSameOriginRequest(request)) return json({ error: "Cross-origin request rejected." }, 403);
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
    return json({ error: "Content-Type must be application/json." }, 415);
  }

  let raw;
  try { raw = await request.text(); } catch { return json({ error: "Request body could not be read." }, 400); }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: "Request body is too large." }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: "Request body must contain valid JSON." }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).length !== 2 ||
      typeof body.sourceUrl !== "string" || typeof body.blobSha !== "string") {
    return json({ error: "Provide exactly sourceUrl and blobSha fields." }, 400);
  }

  try {
    const blob = await readGitHubBlob(body.sourceUrl, body.blobSha, fetchImpl);
    return json(blob);
  } catch (error) {
    if (error instanceof TypeError) return json({ error: error.message }, 400);
    if (error instanceof GitHubSourceError) return json({ error: error.message }, error.status);
    return json({ error: "Source blob could not be read." }, 502);
  }
}
