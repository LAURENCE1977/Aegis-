import { authorizePrincipal, jsonResponse } from "../../lib/owner-api.mjs";
import { getWorkspace, listWorkspaceEvents } from "../../lib/project-spaces.mjs";


export async function onRequestGet({ request, env, params }) {
  const auth = await authorizePrincipal(request, env);
  if (auth.response) return auth.response;
  const { principal } = auth;
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return jsonResponse({ error: "Workspace storage is not configured." }, 503);
  }
  const id = params?.id;
  if (typeof id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id)) {
    return jsonResponse({ error: "Workspace not found." }, 404);
  }
  try {
    const workspace = await getWorkspace(env.AEGIS_DB, principal, id);
    if (!workspace) return jsonResponse({ error: "Workspace not found." }, 404);
    const events = await listWorkspaceEvents(env.AEGIS_DB, principal, id, 50);
    return jsonResponse({ workspace, events: events || [] });
  } catch {
    return jsonResponse({ error: "Workspace could not be loaded." }, 503);
  }
}
