import {
  constantTimeEqual,
  createReviewerSessionToken,
  isReviewerAuthorized,
  isSameOriginRequest,
  reviewerAuthConfigAvailable,
  reviewerSessionCookie,
  clearReviewerSessionCookie,
} from "../lib/auth.mjs";
import { jsonResponse, readJsonRequest } from "../lib/owner-api.mjs";

const MAX_BODY_BYTES = 1024;

export async function onRequestGet({ request, env }) {
  if (!reviewerAuthConfigAvailable(env)) {
    return jsonResponse({ error: "Independent reviewer sign-in is not configured." }, 503);
  }
  return jsonResponse({ authenticated: await isReviewerAuthorized(request, env) });
}

export async function onRequestPost({ request, env }) {
  if (!reviewerAuthConfigAvailable(env)) {
    return jsonResponse({ error: "Independent reviewer sign-in is not configured." }, 503);
  }
  if (!isSameOriginRequest(request)) return jsonResponse({ error: "Invalid request origin." }, 403);
  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  if (!parsed.body || typeof parsed.body !== "object" || Array.isArray(parsed.body) ||
      Object.keys(parsed.body).length !== 1 || !Object.hasOwn(parsed.body, "password")) {
    return jsonResponse({ error: "A reviewer password is required." }, 400);
  }
  if (!constantTimeEqual(parsed.body.password, env.AEGIS_REVIEWER_PASSWORD)) {
    return jsonResponse({ error: "Incorrect reviewer password." }, 401);
  }
  const token = await createReviewerSessionToken(env.AEGIS_REVIEWER_SESSION_SECRET);
  return jsonResponse({ authenticated: true, principalId: "reviewer" }, 200, {
    "Set-Cookie": reviewerSessionCookie(token),
  });
}

export async function onRequestDelete({ request }) {
  if (!isSameOriginRequest(request)) return jsonResponse({ error: "Invalid request origin." }, 403);
  return jsonResponse({ authenticated: false }, 200, {
    "Set-Cookie": clearReviewerSessionCookie(),
  });
}
