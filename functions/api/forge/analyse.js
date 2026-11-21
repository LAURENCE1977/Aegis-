import { authConfigAvailable, isAuthorized, isSameOriginRequest } from "../../lib/auth.mjs";
import { readBoundedText } from "../../lib/request-body.mjs";
import {
  inspectGitHubRepository,
  readGitHubBlob,
  GitHubSourceError,
} from "../../lib/github-discovery.mjs";
import { assessPinnedSoftwareSource } from "../../../workers/runtime/software-intelligence-analysis.mjs";

const MAX_BODY_BYTES = 4096;
const MAX_ANALYSIS_FILES = 20;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  },
});

export async function onRequestPost({ request, env, fetchImpl = fetch }) {
  if (!authConfigAvailable(env)) return json({ error: "Authentication is not configured." }, 503);
  if (!(await isAuthorized(request, env))) return json({ error: "Authentication required." }, 401);
  if (!isSameOriginRequest(request)) return json({ error: "Cross-origin request rejected." }, 403);
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
    return json({ error: "Content-Type must be application/json." }, 415);
  }

  let raw;
  try {
    raw = await readBoundedText(request, MAX_BODY_BYTES);
  } catch (error) {
    return json({ error: error.message }, error.status || 400);
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Request body must contain valid JSON." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).length !== 1 || typeof body.sourceUrl !== "string") {
    return json({ error: "Provide exactly one sourceUrl field." }, 400);
  }

  try {
    const repository = await inspectGitHubRepository(body.sourceUrl, fetchImpl);
    const available = repository.files;
    const selected = available.slice(0, MAX_ANALYSIS_FILES);
    if (selected.length === 0) {
      return json({ error: "No supported text source files were found for analysis." }, 422);
    }

    const files = [];
    for (const entry of selected) {
      const blob = await readGitHubBlob(body.sourceUrl, entry.sha, fetchImpl);
      if (blob.sha.toLowerCase() !== entry.sha.toLowerCase() || blob.size !== entry.size) {
        throw new GitHubSourceError("A source blob did not match its inspected tree entry.", 502);
      }
      files.push({
        path: entry.path,
        sha: blob.sha,
        size: blob.size,
        content: blob.content,
      });
    }

    const observedAt = new Date().toISOString();
    const analysis = assessPinnedSoftwareSource({
      repository: repository.fullName,
      treeSha: repository.treeSha,
      observedAt,
      files,
    });

    const filesSkipped = Math.max(0, available.length - selected.length);
    return json({
      analysis,
      inspection: {
        filesAvailable: available.length,
        filesSelected: selected.length,
        filesSkipped,
        truncated: Boolean(repository.truncated) || filesSkipped > 0,
      },
    });
  } catch (error) {
    if (error instanceof TypeError) return json({ error: error.message }, 400);
    if (error instanceof GitHubSourceError) return json({ error: error.message }, error.status);
    return json({ error: "Forge source analysis failed closed." }, 502);
  }
}
