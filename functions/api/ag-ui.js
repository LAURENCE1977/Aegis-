import { authConfigAvailable, resolveSessionPrincipal, isSameOriginRequest } from "../lib/auth.mjs";
import { buildAskMessages } from "./ask.js";
import { getWorkspace } from "../lib/project-spaces.mjs";
import { createModelStream } from "../lib/model-provider.mjs";
import {
  executeAgentToolCall,
  getAgentToolDefinitions,
  isAgentToolingEnabled,
} from "../lib/agent-tools.mjs";
import {
  createTextRunStartEvents,
  createTextRunContentEvent,
  createTextRunFinishEvents,
  createTextRunErrorEvent,
  encodeAgUiSse,
  createAgUiSseResponse,
} from "../lib/ag-ui.mjs";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGES = 11;
const MAX_TEXT = 4000;
const MAX_OUTPUT = 12000;
const MAX_TOOL_RESULT = 4000;
const MAX_PROVIDER_FRAME_BYTES = 16 * 1024;
const MAX_PROVIDER_STREAM_BYTES = 256 * 1024;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export async function onRequestPost(context) {
  const { request, env } = context;
  const fetchImpl = context.fetchImpl || fetch;
  if (!authConfigAvailable(env)) return json({ error: "Authentication is not configured." }, 503);
  const principal = await resolveSessionPrincipal(request, env);
  if (!principal) return json({ error: "Authentication required." }, 401);
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

  let projectId = null;
  if (input.projectId !== undefined) {
    if (typeof input.projectId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.projectId)) {
      return json({ error: "Invalid Project Space identifier." }, 400);
    }
    if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
      return json({ error: "Project Space storage is not configured." }, 503);
    }
    try {
      const workspace = await getWorkspace(env.AEGIS_DB, principal, input.projectId);
      if (!workspace || workspace.status !== "active") return json({ error: "Project Space not found." }, 404);
      projectId = input.projectId;
    } catch {
      return json({ error: "Project Space could not be verified." }, 503);
    }
  }

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

  const toolsEnabled = isAgentToolingEnabled(env);
  const tools = toolsEnabled ? getAgentToolDefinitions() : undefined;
  let promptMessages;
  let modelStream;
  try {
    const history = messages.slice(0, -1).slice(-10);
    promptMessages = await buildAskMessages(env, latest.content, history, { projectId, principal });
    modelStream = await createModelStream({ env, messages: promptMessages, tools, fetchImpl });
  } catch (error) {
    if (String(env.AEGIS_MODEL_PROVIDER || "workers-ai") === "alibaba-qwen" &&
        (!env.AEGIS_QWEN_API_KEY || !env.AEGIS_QWEN_WORKSPACE_ID || !env.AEGIS_QWEN_REGION)) {
      return createAgUiSseResponse([
        createTextRunErrorEvent({ message: "The configured Qwen provider is not ready.", code: "PROVIDER_NOT_READY" }),
      ], 503);
    }
    if (error instanceof TypeError) {
      return createAgUiSseResponse([
        createTextRunErrorEvent({ message: "The model request is invalid.", code: "INVALID_MODEL_REQUEST" }),
      ], 400);
    }
    return createAgUiSseResponse([
      createTextRunErrorEvent({ message: "The AI could not start this run. Please try again.", code: "AGENT_START_FAILED" }),
    ], 502);
  }
  if (!modelStream || typeof modelStream.getReader !== "function") {
    return createAgUiSseResponse([
      createTextRunErrorEvent({ message: "The AI provider did not return a readable stream.", code: "INVALID_PROVIDER_STREAM" }),
    ], 502);
  }

  return createStreamingAgUiResponse(modelStream, {
    threadId: input.threadId,
    runId: input.runId,
    startEvents,
    toolContext: toolsEnabled ? {
      env,
      db: env.AEGIS_DB,
      fetchImpl,
      promptMessages,
      allowedToolNames: tools.map(tool => tool.function.name),
    } : null,
  });
}

function createStreamingAgUiResponse(modelStream, { threadId, runId, startEvents, toolContext }) {
  const encoder = new TextEncoder();
  let reader;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(encodeAgUiSse(startEvents)));
      (async () => {
        let activeStream = modelStream;
        let outputLength = 0;
        let cancelled = false;
        let toolRound = 0;

        const emitText = (delta) => {
          if (typeof delta !== "string" || !delta || outputLength >= MAX_OUTPUT) return;
          const bounded = delta.slice(0, MAX_OUTPUT - outputLength);
          if (!bounded) return;
          outputLength += bounded.length;
          controller.enqueue(encoder.encode(encodeAgUiSse([
            createTextRunContentEvent({ runId, delta: bounded }),
          ])));
        };

        const emitError = (code, message) => {
          controller.enqueue(encoder.encode(encodeAgUiSse([
            createTextRunErrorEvent({ message, code }),
          ])));
        };

        try {
          while (activeStream) {
            reader = activeStream.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let finished = false;
            let messageText = "";
            const toolCalls = new Map();
            let providerBytes = 0;

            const accumulateToolCalls = (deltas) => {
              if (!Array.isArray(deltas)) return;
              for (const delta of deltas) {
                if (!delta || typeof delta !== "object") continue;
                const index = Number.isInteger(delta.index) ? delta.index : 0;
                if (index < 0 || index > 3) throw agentStreamError("INVALID_TOOL_CALL", "The AI returned an invalid tool call.");
                const current = toolCalls.get(index) || {
                  id: "",
                  type: "function",
                  function: { name: "", arguments: "" },
                };
                if (typeof delta.id === "string") current.id = delta.id;
                if (typeof delta.type === "string") current.type = delta.type;
                if (typeof delta.function?.name === "string") current.function.name += delta.function.name;
                if (typeof delta.function?.arguments === "string") {
                  current.function.arguments += delta.function.arguments;
                }
                if (current.function.name.length > 64 || current.function.arguments.length > 4096) {
                  throw agentStreamError("INVALID_TOOL_CALL", "The AI tool call exceeded its size limit.");
                }
                toolCalls.set(index, current);
              }
            };

            const processFrame = (frame) => {
              if (frame.length > MAX_PROVIDER_FRAME_BYTES) {
                throw agentStreamError("PROVIDER_FRAME_TOO_LARGE", "The AI provider sent an oversized frame.");
              }
              const data = frame.split(/\r?\n/)
                .filter(line => line.startsWith("data:"))
                .map(line => line.slice(5).trimStart())
                .join("\n");
              if (!data) return;
              if (data.trim() === "[DONE]") { finished = true; return; }
              let payload;
              try { payload = JSON.parse(data); } catch { return; }
              if (payload.type === "error") {
                throw agentStreamError(
                  "PROVIDER_STREAM_ERROR",
                  "The AI provider reported an error during streaming.",
                );
              }
              if (payload.type === "message_stop") {
                finished = true;
                return;
              }
              const delta = payload.type === "content_block_delta" &&
                  payload.delta?.type === "text_delta" &&
                  typeof payload.delta.text === "string"
                ? payload.delta.text
                : typeof payload.response === "string"
                  ? payload.response
                  : typeof payload.choices?.[0]?.delta?.content === "string"
                    ? payload.choices[0].delta.content
                    : "";
              if (delta) {
                const boundedDelta = delta.slice(0, Math.max(0, MAX_OUTPUT - outputLength));
                if (boundedDelta) {
                  messageText += boundedDelta;
                  emitText(boundedDelta);
                }
              }
              accumulateToolCalls(payload.choices?.[0]?.delta?.tool_calls);
            };

            const drainFrames = (flush = false) => {
              while (true) {
                const match = /\r?\n\r?\n/.exec(buffer);
                if (!match) break;
                const index = match.index;
                if (index > MAX_PROVIDER_FRAME_BYTES) {
                  throw agentStreamError("PROVIDER_FRAME_TOO_LARGE", "The AI provider sent an oversized frame.");
                }
                processFrame(buffer.slice(0, index));
                buffer = buffer.slice(index + match[0].length);
                if (finished) break;
              }
              if (flush && buffer.trim()) {
                if (buffer.length > MAX_PROVIDER_FRAME_BYTES) {
                  throw agentStreamError("PROVIDER_FRAME_TOO_LARGE", "The AI provider sent an oversized frame.");
                }
                processFrame(buffer);
                buffer = "";
              }
              if (buffer.length > MAX_PROVIDER_FRAME_BYTES) {
                throw agentStreamError("PROVIDER_FRAME_TOO_LARGE", "The AI provider sent an oversized frame.");
              }
            };

            while (!finished) {
              const { done, value } = await reader.read();
              if (done) break;
              providerBytes += value.byteLength;
              if (providerBytes > MAX_PROVIDER_STREAM_BYTES) {
                await reader.cancel("AEGIS provider stream size limit reached");
                throw agentStreamError("PROVIDER_STREAM_TOO_LARGE", "The AI provider response exceeded its size limit.");
              }
              buffer += decoder.decode(value, { stream: true });
              drainFrames();
              if (outputLength >= MAX_OUTPUT) {
                cancelled = true;
                await reader.cancel("AEGIS response size limit reached");
                break;
              }
            }
            buffer += decoder.decode();
            drainFrames(true);
            try { reader.releaseLock(); } catch {}

            if (cancelled) {
              activeStream = null;
              break;
            }

            const calls = [...toolCalls.values()];
            if (!calls.length) {
              activeStream = null;
              break;
            }
            if (!toolContext) {
              throw agentStreamError("TOOLS_NOT_ENABLED", "Tool calls are not enabled for this AEGIS run.");
            }
            if (toolRound >= 1) {
              throw agentStreamError("TOOL_RECURSION_NOT_ALLOWED", "AEGIS allows one permissioned tool call per run.");
            }
            if (calls.length !== 1) {
              throw agentStreamError("TOOL_CALL_LIMIT", "AEGIS allows one permissioned tool call per run.");
            }

            const call = calls[0];
            if (call.type !== "function" ||
                typeof call.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(call.id) ||
                !toolContext.allowedToolNames.includes(call.function.name)) {
              throw agentStreamError("TOOL_NOT_ALLOWED", "The requested tool is not in the server-owned AEGIS tool registry.");
            }

            const toolResult = await executeAgentToolCall({
              name: call.function.name,
              argumentsText: call.function.arguments,
              db: toolContext.db,
              principalId: "owner",
              fetchImpl: toolContext.fetchImpl,
            });
            const toolContent = boundedToolResult(toolResult);
            const assistantToolCall = {
              role: "assistant",
              content: messageText,
              tool_calls: [{
                id: call.id,
                type: "function",
                function: {
                  name: call.function.name,
                  arguments: call.function.arguments,
                },
              }],
            };
            const toolMessage = {
              role: "tool",
              tool_call_id: call.id,
              name: call.function.name,
              content: toolContent,
            };
            activeStream = await createModelStream({
              env: toolContext.env,
              messages: [...toolContext.promptMessages, assistantToolCall, toolMessage],
              fetchImpl: toolContext.fetchImpl,
            });
            toolRound += 1;
          }

          controller.enqueue(encoder.encode(encodeAgUiSse(
            createTextRunFinishEvents({ threadId, runId, outcome: cancelled ? "cancelled" : undefined }),
          )));
          controller.close();
        } catch (error) {
          try { await reader?.cancel(error); } catch {}
          try {
            emitError(
              typeof error?.code === "string" ? error.code : "AGENT_STREAM_FAILED",
              typeof error?.publicMessage === "string" ? error.publicMessage : "The AI stream ended unexpectedly.",
            );
            controller.close();
          } catch {}
        } finally {
          try { reader?.releaseLock(); } catch {}
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

function agentStreamError(code, publicMessage) {
  const error = new Error(publicMessage);
  error.code = code;
  error.publicMessage = publicMessage;
  return error;
}

function boundedToolResult(result) {
  const serialized = JSON.stringify(result);
  if (serialized.length <= MAX_TOOL_RESULT) return serialized;
  const compact = {
    ok: result?.ok === true,
    reasonCode: result?.reasonCode || "TOOL_RESULT_TOO_LARGE",
    invocationId: result?.invocationId,
  };
  if (Array.isArray(result?.output?.modules)) {
    compact.output = {
      total: result.output.total,
      modules: result.output.modules.slice(0, 8).map(module => ({
        id: module.id,
        name: module.name,
        status: module.status,
      })),
    };
  }
  const compactJson = JSON.stringify(compact);
  return compactJson.length <= MAX_TOOL_RESULT
    ? compactJson
    : JSON.stringify({ ok: false, reasonCode: "TOOL_RESULT_TOO_LARGE" });
}

function validateRunInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return "Invalid AG-UI request.";
  if (Object.keys(input).some(key => !["threadId", "runId", "protocolVersion", "messages", "tools", "context", "projectId"].includes(key))) return "Unsupported AG-UI request fields.";
  if (input.protocolVersion !== undefined && input.protocolVersion !== "1.0") return "Unsupported AG-UI protocol version.";
  if (typeof input.threadId !== "string" || typeof input.runId !== "string") return "AG-UI threadId and runId are required.";
  if (!Array.isArray(input.messages) || !input.messages.length || input.messages.length > MAX_MESSAGES) return "Invalid AG-UI messages.";
  if (input.tools !== undefined && (!Array.isArray(input.tools) || input.tools.length)) return "Frontend tools are not enabled until Sentinel mediation is connected.";
  if (input.context !== undefined && (!Array.isArray(input.context) || input.context.length)) return "Ambient context is not enabled on this endpoint.";
  if (input.resume !== undefined && (!Array.isArray(input.resume) || input.resume.length)) return "AG-UI resume is not enabled on this endpoint.";
  if (input.state !== undefined || input.forwardedProps !== undefined || input.parentRunId !== undefined) return "Unsupported AG-UI run fields.";
  for (const message of input.messages) {
    if (!message || typeof message !== "object" || Array.isArray(message) ||
        Object.keys(message).some(key => !["id", "role", "content"].includes(key)) ||
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
