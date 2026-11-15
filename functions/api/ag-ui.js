import { authConfigAvailable, isAuthorized, isSameOriginRequest } from "../lib/auth.mjs";
import { createTextRunEvents, createAgUiSseResponse } from "../lib/ag-ui.mjs";
import { onRequestPost as ask } from "./ask.js";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGES = 11;
const MAX_TEXT = 4000;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!authConfigAvailable(env)) return json({ error: "Authentication is not configured." }, 503);
  if (!(await isAuthorized(request, env))) return json({ error: "Authentication required." }, 401);
  if (!isSameOriginRequest(request)) return json({ error: "Invalid request origin." }, 403);

  let bodyText;
  try { bodyText = await readBoundedBody(request, MAX_BODY_BYTES); }
  catch (error) {
    return json({ error: error.message }, error.status || 400);
  }

  let input;
  try { input = JSON.parse(bodyText); }
  catch { return json({ error: "Invalid AG-UI JSON request." }, 400); }

  const validation = validateRunInput(input);
  if (validation) return json({ error: validation }, 400);

  const messages = input.messages;
  const latest = messages[messages.length - 1];
  if (latest.role !== "user" || !latest.content.trim()) {
    return json({ error: "The final AG-UI message must contain a user question." }, 400);
  }

  // Validate run/thread identifiers before invoking the model.
  try {
    createTextRunEvents({ threadId: input.threadId, runId: input.runId, message: "" });
  } catch {
    return json({ error: "Invalid AG-UI thread or run identifier." }, 400);
  }

  const history = messages.slice(0, -1).slice(-10).map(message => ({
    role: message.role,
    content: message.content,
  }));
  const askHeaders = new Headers(request.headers);
  askHeaders.set("Content-Type", "application/json");
  askHeaders.delete("Content-Length");
  const askRequest = new Request(new URL("/api/ask", request.url), {
    method: "POST",
    headers: askHeaders,
    body: JSON.stringify({ question: latest.content, history }),
  });

  const answer = await ask({ request: askRequest, env });
  if (!answer.ok) return answer;

  let result;
  try { result = await answer.json(); }
  catch { return json({ error: "The AEGIS agent returned an invalid response." }, 502); }

  const text = typeof result.response === "string" ? result.response
    : typeof result.answer === "string" ? result.answer
      : typeof result.result?.response === "string" ? result.result.response
        : null;
  if (text === null) return json({ error: "The AEGIS agent returned no text response." }, 502);

  try {
    return createAgUiSseResponse(createTextRunEvents({
      threadId: input.threadId,
      runId: input.runId,
      message: text.slice(0, 12000),
    }));
  } catch {
    return json({ error: "The AEGIS agent response could not be encoded." }, 502);
  }
}

function validateRunInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return "Invalid AG-UI request.";
  if (input.protocolVersion !== undefined && input.protocolVersion !== "1.0") return "Unsupported AG-UI protocol version.";
  if (typeof input.threadId !== "string" || typeof input.runId !== "string") return "AG-UI threadId and runId are required.";
  if (!Array.isArray(input.messages) || !input.messages.length || input.messages.length > MAX_MESSAGES) return "Invalid AG-UI messages.";
  if (input.tools !== undefined && (!Array.isArray(input.tools) || input.tools.length)) return "Frontend tools are not enabled until Sentinel mediation is connected.";
  if (input.context !== undefined && (!Array.isArray(input.context) || input.context.length)) return "Ambient context is not enabled on this endpoint.";
  if (input.resume !== undefined && (!Array.isArray(input.resume) || input.resume.length)) return "AG-UI resume is not enabled on this endpoint.";
  if (input.state !== undefined || input.forwardedProps !== undefined || input.parentRunId !== undefined) return "Unsupported AG-UI run fields.";
  for (const message of input.messages) {
    if (!message || typeof message !== "object" || Array.isArray(message) ||
        !["user", "assistant"].includes(message.role) ||
        typeof message.content !== "string" || message.content.length > MAX_TEXT ||
        typeof message.id !== "string" || !message.id.trim() || message.id.length > 128) {
      return "Only bounded plain-text user and assistant messages are supported.";
    }
  }
  return null;
}

async function readBoundedBody(request, maxBytes) {
  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    const error = new Error("Request body exceeds the size limit.");
    error.status = 413;
    throw error;
  }
  if (!request.body) throw new Error("Request body is required.");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let output = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      const error = new Error("Request body exceeds the size limit.");
      error.status = 413;
      throw error;
    }
    output += decoder.decode(value, { stream: true });
  }
  output += decoder.decode();
  return output;
}
