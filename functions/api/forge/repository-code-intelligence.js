import { authConfigAvailable, isAuthorized, isSameOriginRequest } from "../../lib/auth.mjs";
import { readBoundedText } from "../../lib/request-body.mjs";
import {
  inspectGitHubRepository,
  readGitHubBlob,
  GitHubSourceError,
} from "../../lib/github-discovery.mjs";
import { analyzeJavaScriptModuleGraph } from "../../lib/forge-code-intelligence.mjs";

const MAX_BODY_BYTES = 32 * 1024;
const MAX_SELECTED_FILES = 50;
const TREE_SHA_PATTERN = /^[a-f0-9]{40,64}$/i;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

function exactKeys(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every(key => keys.includes(key));
}

export async function onRequestPost({ request, env, fetchImpl = fetch }) {
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
  if (!exactKeys(body, ["sourceUrl", "treeSha", "files"]) ||
      typeof body.sourceUrl !== "string" ||
      typeof body.treeSha !== "string" || !TREE_SHA_PATTERN.test(body.treeSha) ||
      !Array.isArray(body.files) || body.files.length < 1 ||
      body.files.length > MAX_SELECTED_FILES) {
    return json({ error: "Provide sourceUrl, a pinned treeSha and between 1 and 50 selected files." }, 400);
  }

  const selected = new Map();
  for (const item of body.files) {
    if (!exactKeys(item, ["path", "sha"]) || typeof item.path !== "string" ||
        typeof item.sha !== "string" || !TREE_SHA_PATTERN.test(item.sha) ||
        selected.has(item.path)) {
      return json({ error: "Each selected file must have a unique path and pinned blob SHA." }, 400);
    }
    selected.set(item.path, item.sha.toLowerCase());
  }

  try {
    const repository = await inspectGitHubRepository(body.sourceUrl, fetchImpl);
    if (repository.treeSha.toLowerCase() !== body.treeSha.toLowerCase()) {
      return json({
        error: "The repository tree has changed since it was inspected. Refresh the source list and select files again.",
        currentTreeSha: repository.treeSha,
      }, 409);
    }

    const available = new Map(repository.files.map(file => [file.path, file]));
    const chosen = [];
    for (const [path, sha] of selected) {
      const entry = available.get(path);
      if (!entry || entry.sha.toLowerCase() !== sha) {
        return json({ error: "A selected path or blob SHA does not match the pinned inspectable repository tree." }, 400);
      }
      if (!/\.(?:js|jsx|mjs|cjs|ts|tsx)$/i.test(path) || entry.size > 32 * 1024) {
        return json({ error: "Selected files must be supported JavaScript/TypeScript source files no larger than 32 KiB." }, 400);
      }
      chosen.push(entry);
    }

    const files = [];
    for (const entry of chosen) {
      const blob = await readGitHubBlob(repository.sourceUrl, entry.sha, fetchImpl);
      if (blob.sha.toLowerCase() !== entry.sha.toLowerCase() || blob.size !== entry.size) {
        return json({ error: "A source blob did not match its pinned repository tree metadata." }, 502);
      }
      files.push({ path: entry.path, content: blob.content });
    }

    const graph = analyzeJavaScriptModuleGraph(files);
    return json({
      repository: {
        sourceUrl: repository.sourceUrl,
        fullName: repository.fullName,
        defaultBranch: repository.defaultBranch,
        treeSha: repository.treeSha,
        selectedFileCount: files.length,
      },
      graph,
    });
  } catch (error) {
    if (error instanceof TypeError) return json({ error: error.message }, 400);
    if (error instanceof GitHubSourceError) return json({ error: error.message }, error.status);
    return json({ error: "Pinned repository code analysis failed." }, 502);
  }
}
