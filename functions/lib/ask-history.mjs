const encoder = new TextEncoder();

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=";
    const binary = atob(base64);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function historyKey(secret) {
  if (typeof secret !== "string" || secret.length < 32) throw new TypeError("Session signing secret unavailable");
  const master = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const derived = await crypto.subtle.sign("HMAC", master, encoder.encode("AEGIS assistant-history key v1"));
  return crypto.subtle.importKey(
    "raw", derived, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}

function canonicalTurn({ sid, conversationId, content }) {
  return JSON.stringify({
    version: 1,
    domain: "aegis-assistant-turn",
    sid,
    conversationId,
    role: "assistant",
    content,
  });
}

export async function signAssistantTurn(secret, sid, conversationId, content) {
  if (typeof sid !== "string" || !sid || typeof conversationId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(conversationId) ||
      typeof content !== "string" || !content.trim() || content.length > 4000) {
    throw new TypeError("Invalid assistant turn");
  }
  const key = await historyKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(canonicalTurn({ sid, conversationId, content })));
  return toBase64Url(new Uint8Array(signature));
}

export async function verifyAssistantTurn(secret, sid, conversationId, content, signature) {
  const bytes = fromBase64Url(signature);
  if (!bytes || typeof sid !== "string" || !sid ||
      typeof conversationId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(conversationId) ||
      typeof content !== "string" || !content.trim() || content.length > 4000) return false;
  try {
    const key = await historyKey(secret);
    return await crypto.subtle.verify(
      "HMAC", key, bytes, encoder.encode(canonicalTurn({ sid, conversationId, content }))
    );
  } catch {
    return false;
  }
}
