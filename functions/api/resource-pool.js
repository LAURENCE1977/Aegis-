import { authorizeOwner, jsonResponse } from "../lib/owner-api.mjs";
import { readResourcePoolSnapshot } from "../lib/resource-pool.mjs";

export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;

  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return jsonResponse({ error: "Resource-pool storage is not configured." }, 503);
  }

  try {
    const snapshot = await readResourcePoolSnapshot({
      db: env.AEGIS_DB,
      now: new Date().toISOString(),
    });
    return jsonResponse(snapshot);
  } catch {
    return jsonResponse({ error: "Resource-pool snapshot is temporarily unavailable." }, 503);
  }
}
