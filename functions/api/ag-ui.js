import { authConfigAvailable, isAuthorized, isSameOriginRequest } from "../lib/auth.mjs";
import { buildAskMessages } from "./ask.js";
import {
  createTextRunStartEvents,
  createTextRunContentEvent,
  createTextRunFinishEvents,
  createTextRunErrorEvent,
  encodeAgUiSse,
} from "../lib/ag-ui.mjs";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGES = 11;
const MAX_TEXT = 4000;
const MAX_OUTPUT = 12000;
const MODEL = "@cf/meta/llama-3.3-70b-instruct";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!authConfigAvailable(env)) return json({ error: "Authentication is not configured." }, 503);
  if (!(await isAuthorized(request, env))) return json({ error: "Authentication required." }, 401);
  if (!isSameOriginRequest(request)) return json({ error: "Invalid request origin." }, 403);
  if (!env.AI || typeof env.AI.run !== "function") return json({ error: "No AI provider configured." }, 503);

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

  let startEvents;
  try {
    startEvents = createTextRunStartEvents({ threadId: input.threadId, runId: input.runId });
  } catch {
    return json({ error: "Invalid AG-UI thread or run identifier." }, 400);
  }

  let modelStream;
  try {
    const history = messages.slice(0, -1).slice(-10);
    const promptMessages = await buildAskMessages(env, latest.content, history);
    modelStream = await env.AI.run(MODEL, {
      messages: promptMessages,
      max_tokens: 1024,
      stream: true,
    });
  } catch {
    return json({ error: "The AI could not start this run. Please try again." }, 502);
  }
  if (!modelStream || typeof modelStream.getReader !== "function") {
    return json({ error: "The AI provider did not return a readable stream." }, 502);
  }

  return createStreamingAgUiResponse(modelStream, {
    threadId: input.threadId,
    runId: input.runId,
    startEvents,
  });
}

function createStreamingAgUiResponse(modelStream, { threadId, runId, startEvents }) {
  const encoder = new TextEncoder();
  let reader;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(encodeAgUiSse(startEvents)));
      reader = modelStream.getReader();
      (async () => {
        const decoder = new TextDecoder();
        let buffer = "";
        let outputLength = 0;
        let finished = false;

        const emitText = (delta) => {
          if (typeof delta !== "string" || !delta || outputLength >= MAX_OUTPUT) return;
          const bounded = delta.slice(0, MAX_OUTPUT - outputLength);
          if (!bounded) return;
          outputLength += bounded.length;
          controller.enqueue(encoder.encode(encodeAgUiSse([
            createTextRunContentEvent({ runId, delta: bounded }),
          ])));
        };

        const processFrame = (frame) => {
          const data = frame.split(/\r?\n/)
            .filter(line => line.startsWith("data:"))
            .map(line => line.slice(5).trimStart())
            .join("\n");
          if (!data) return;
          if (data.trim() === "[DONE]") { finished = true; return; }
          let payload;
          try { payload = JSON.parse(data); } catch { return; }
          const delta = typeof payload.response === "string"
            ? payload.response
            : typeof payload.choices?.[0]?.delta?.content === "string"
              ? payload.choices[0].delta.content
              : "";
          emitText(delta);
        };

        const drainFrames = (flush = false) => {
          while (true) {
            const match = /\r?\n\r?\n/.exec(buffer);
            if (!match) break;
            const index = match.index;
            processFrame(buffer.slice(0, index));
            buffer = buffer.slice(index + match[0].length);
            if (finished) break;
          }
          if (flush && buffer.trim()) {
            processFrame(buffer);
            buffer = "";
          }
        };

        try {
          while (!finished) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            drainFrames();
            if (outputLength >= MAX_OUTPUT) {
              await reader.cancel("AEGIS response size limit reached");
              break;
            }
          }
          buffer += decoder.decode();
          drainFrames(true);
          controller.enqueue(encoder.encode(encodeAgUiSse(
            createTextRunFinishEvents({ threadId, runId }),
          )));
          controller.close();
        } catch {
          try {
            controller.enqueue(encoder.encode(encodeAgUiSse([
              createTextRunErrorEvent({ message: "The AI stream ended unexpectedly." }),
            ])));
            controller.close();
          } catch {}
        } finally {
          try { reader.releaseLock(); } catch {}
        }
      })();
    },
    cancel(reason) {
      return reader?.cancel(reason);
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
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
