import { authConfigAvailable, isAuthorized, isSameOriginRequest } from "../../lib/auth.mjs";
import { discoverGitHubRepository, GitHubSourceError } from "../../lib/github-discovery.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  },
});

export async function onRequestPost({ request, env, fetchImpl = fetch }) {
  if (!authConfigAvailable(env)) {
    return json({ error: "Authentication is not configured." }, 503);
  }
  if (!(await isAuthorized(request, env))) {
    return json({ error: "Authentication required." }, 401);
  }
  if (!isSameOriginRequest(request)) {
    return json({ error: "Cross-origin request rejected." }, 403);
  }

  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return json({ error: "Content-Type must be application/json." }, 415);
  }
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > 4096) {
    return json({ error: "Request body is too large." }, 413);
  }

  let rawBody;
  try {
    rawBody = await request.text();
  } catch {
    return json({ error: "Request body could not be read." }, 400);
  }
  if (rawBody.length > 4096) {
    return json({ error: "Request body is too large." }, 413);
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "Request body must contain valid JSON." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).length !== 1 || typeof body.sourceUrl !== "string") {
    return json({ error: "Provide exactly one sourceUrl field." }, 400);
  }

  try {
    const repository = await discoverGitHubRepository(body.sourceUrl, fetchImpl);
    return json({ repository });
  } catch (error) {
    if (error instanceof TypeError) {
      return json({ error: error.message }, 400);
    }
    if (error instanceof GitHubSourceError) {
      return json({ error: error.message }, error.status);
    }
    return json({ error: "Repository discovery failed." }, 502);
  }
}
