import { authConfigAvailable, isAuthorized } from "../lib/auth.mjs";
import { listCapabilityManifests } from "../lib/capability-registry.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  },
});

export async function onRequestGet({ request, env }) {
  if (!authConfigAvailable(env)) {
    return json({ error: "Authentication is not configured." }, 503);
  }
  if (!(await isAuthorized(request, env))) {
    return json({ error: "Authentication required." }, 401);
  }

  const capabilities = listCapabilityManifests();
  // The catalogue is descriptive. No grants or executable permissions are returned.
  return json({ capabilities, total: capabilities.length, grants: [] });
}
