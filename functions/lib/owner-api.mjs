import {
  authConfigAvailable,
  isAuthorized,
  isSameOriginRequest,
  reviewerAuthConfigAvailable,
  isReviewerAuthorized,
} from "./auth.mjs";

export const jsonResponse = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    ...extraHeaders,
  },
});

export async function authorizeOwner(request, env) {
  if (!authConfigAvailable(env)) {
    return jsonResponse({ error: "Authentication is not configured." }, 503);
  }
  if (!(await isAuthorized(request, env))) {
    return jsonResponse({ error: "Authentication required." }, 401);
  }
  return null;
}

export async function authorizeReviewer(request, env) {
  if (!reviewerAuthConfigAvailable(env)) {
    return jsonResponse({ error: "Independent reviewer authentication is not configured." }, 503);
  }
  if (!(await isReviewerAuthorized(request, env))) {
    return jsonResponse({ error: "Independent reviewer authentication required." }, 401);
  }
  return null;
}

export function isOwnerWriteRequest(request) {
  return isSameOriginRequest(request);
}

export async function readJsonRequest(request, maxBytes) {
  const contentType = (request.headers.get("Content-Type") || "")
    .toLowerCase().split(";")[0].trim();
  if (contentType !== "application/json") {
    return { ok: false, status: 415, error: "JSON content type required." };
  }

  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, status: 413, error: "Request body is too large." };
  }

  if (!request.body) {
    return { ok: false, status: 400, error: "Invalid JSON request." };
  }

  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return { ok: false, status: 413, error: "Request body is too large." };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, error: "Invalid request body." };
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON request." };
  }
}
