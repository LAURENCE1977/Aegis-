import {
  authConfigAvailable,
  constantTimeEqual,
  createSessionToken,
  isAuthorized,
  isSameOriginRequest,
  sessionCookie,
  clearSessionCookie,
} from "../lib/auth.mjs";

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    ...headers,
  },
});

export async function onRequestGet({ request, env }) {
  if (!authConfigAvailable(env)) {
    return json({ error: "Authentication is not configured. Set AEGIS_PASSWORD and AEGIS_SESSION_SECRET." }, 503);
  }
  return json({ authenticated: await isAuthorized(request, env) });
}

export async function onRequestPost({ request, env }) {
  if (!authConfigAvailable(env)) {
    return json({ error: "Authentication is not configured. Set AEGIS_PASSWORD and AEGIS_SESSION_SECRET." }, 503);
  }
  if (!isSameOriginRequest(request)) return json({ error: "Invalid request origin." }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  if (!constantTimeEqual(body?.password, env.AEGIS_PASSWORD)) {
    return json({ error: "Incorrect password." }, 401);
  }

  const token = await createSessionToken(env.AEGIS_SESSION_SECRET);
  return json({ authenticated: true }, 200, { "Set-Cookie": sessionCookie(token) });
}

export async function onRequestDelete({ request }) {
  if (!isSameOriginRequest(request)) return json({ error: "Invalid request origin." }, 403);
  return json({ authenticated: false }, 200, { "Set-Cookie": clearSessionCookie() });
}
