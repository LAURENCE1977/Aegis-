import { authConfigAvailable, isAuthorized, isSameOriginRequest } from "../../lib/auth.mjs";
import { readBoundedText } from "../../lib/request-body.mjs";
import { analyzeJavaScriptModuleGraph } from "../../lib/forge-code-intelligence.mjs";

const MAX_BODY_BYTES = 9 * 1024 * 1024;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

export async function onRequestPost({ request, env }) {
  if (!authConfigAvailable(env)) return json({ error: "Authentication is not configured." }, 503);
  if (!(await isAuthorized(request, env))) return json({ error: "Authentication required." }, 401);
  if (!isSameOriginRequest(request)) return json({ error: "Cross-origin request rejected." }, 403);
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
      Object.keys(body).length !== 1 || !Object.hasOwn(body, "files")) {
    return json({ error: "Request must contain only a files array." }, 400);
  }

  try {
    const graph = analyzeJavaScriptModuleGraph(body.files);
    return json({ graph });
  } catch (error) {
    if (error instanceof TypeError) return json({ error: error.message }, 400);
    return json({ error: "Forge code intelligence is temporarily unavailable." }, 503);
  }
}
