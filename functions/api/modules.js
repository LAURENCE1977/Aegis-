import { authConfigAvailable, isAuthorized } from "../lib/auth.mjs";
import { listModules } from "../lib/modules.mjs";

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
  const modules = listModules();
  return json({ modules, total: modules.length });
}
