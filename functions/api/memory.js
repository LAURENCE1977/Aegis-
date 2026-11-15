import { authConfigAvailable, isAuthorized, isSameOriginRequest } from "../lib/auth.mjs";

const KEY = "notes";
const MAX_NOTES = 50;
const MAX_LEN = 300;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });

const unavailable = () => json({ error: "Memory storage is not connected yet." }, 503);

async function load(env) {
  try {
    const list = JSON.parse((await env.MEMORY.get(KEY)) || "[]");
    return Array.isArray(list) ? list.filter(n => typeof n === "string") : [];
  } catch (e) {
    return [];
  }
}

async function authorize(request, env) {
  if (!authConfigAvailable(env)) return json({ error: "Authentication is not configured." }, 503);
  if (!(await isAuthorized(request, env))) return json({ error: "Authentication required." }, 401);
  return null;
}

export async function onRequestGet({ request, env }) {
  const denied = await authorize(request, env);
  if (denied) return denied;
  if (!env.MEMORY) return unavailable();
  return json({ notes: await load(env) });
}

export async function onRequestPost({ request, env }) {
  const denied = await authorize(request, env);
  if (denied) return denied;
  if (!isSameOriginRequest(request)) return json({ error: "Invalid request origin." }, 403);
  if (!env.MEMORY) return unavailable();

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "Invalid request" }, 400); }

  const note = typeof body.note === "string" ? body.note.trim().replace(/\s+/g, " ").slice(0, MAX_LEN) : "";
  if (!note) return json({ error: "Note required" }, 400);

  const notes = await load(env);
  if (notes.includes(note)) return json({ notes });
  if (notes.length >= MAX_NOTES) {
    return json({ error: "Memory is full (50 notes). Use /forget to remove some." }, 400);
  }

  notes.push(note);
  await env.MEMORY.put(KEY, JSON.stringify(notes));
  return json({ notes });
}

export async function onRequestDelete({ request, env }) {
  const denied = await authorize(request, env);
  if (denied) return denied;
  if (!isSameOriginRequest(request)) return json({ error: "Invalid request origin." }, 403);
  if (!env.MEMORY) return unavailable();

  let body = {};
  try { body = await request.json(); } catch (e) {}

  if (Number.isInteger(body.index)) {
    const notes = await load(env);
    if (body.index < 1 || body.index > notes.length) {
      return json({ error: "There is no note with that number." }, 400);
    }
    notes.splice(body.index - 1, 1);
    await env.MEMORY.put(KEY, JSON.stringify(notes));
    return json({ notes });
  }

  await env.MEMORY.delete(KEY);
  return json({ notes: [] });
}
