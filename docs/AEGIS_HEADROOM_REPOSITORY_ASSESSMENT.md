# Headroom repository assessment for AEGIS Infinity

**Repository:** https://github.com/headroomlabs-ai/headroom  
**Reviewed:** 2026-11-23  
**Decision:** promising optional efficiency component; do not install or integrate into the AEGIS control plane yet.

## What it is

Headroom is an Apache-2.0-licensed context-compression toolkit (Python package `headroom-ai`, TypeScript SDK `headroom-ai`). It compresses agent inputs such as tool outputs, logs, RAG chunks, files and conversation history before they are sent to an LLM. It provides:
- an in-process Python `compress(messages)` library;
- a local HTTP proxy for OpenAI-compatible and Anthropic-style requests;
- wrappers for several coding agents;
- an MCP server with `headroom_compress`, `headroom_retrieve` and `headroom_stats`;
- local CCR (compression/cache/retrieval) and cross-agent memory features;
- optional output-shaping and reporting features.

The project README reports measured input-token reductions of 21–57% in four example agent scenarios, with larger reductions on repetitive JSON/log data and little benefit on dense prose. These are the project's own benchmark claims and must be reproduced against AEGIS workloads before relying on them.

## Why it may help AEGIS

- Reduce repeated tool-output/context payloads before a model call.
- Preserve more useful task history within a model's context window.
- Potentially reduce usage of a metered model API if one is ever separately authorised; that is not part of the current free-only plan.
- Offer an optional local MCP utility for compatible AEGIS agents.
- Run compression locally; README states prompt/file content is not sent elsewhere for compression. The resulting request still goes to whichever upstream model provider the operator configured.

## What it does not solve

- It does not extend ChatGPT subscription message limits or grant more ChatGPT turns.
- It does not provide free ChatGPT model inference, API credits, background execution, scheduling, phone control, or a 24/7 coordinator.
- It cannot make this current ChatGPT conversation run continuously.
- Compression is not guaranteed to reduce every payload; prose and already-compact content may compress little.
- It is not a sandbox or security boundary. The project's own `lean` extra is explicitly a dependency profile, not isolation or confinement.

## Cost and licence fit

- Repository declares Apache License 2.0; the fetched LICENSE grants no-charge, royalty-free use subject to licence conditions (retain licence/attribution notices and mark modified files).
- Core local compression is described as in-process and does not require an LLM API key.
- The text compressor may use a Hugging Face model; first-use downloads and optional features can consume network, storage, CPU and memory. `HEADROOM_OFFLINE=1` is documented for zero-network operation, but only after required local assets are available.
- Optional integrations may require separate packages and services. Do not enable hosted memory backends, remote embedding services, provider API calls or paid team features.
- No package was installed and no model was downloaded during this review.

## Security and integration risks to examine

1. **Proxy trust boundary:** the proxy forwards prompts to a configured upstream. Confirm strict upstream allowlisting, TLS verification, authentication handling and that secrets are never logged.
2. **Sensitive data:** compression and CCR may store original content locally for retrieval. Define retention, file permissions, encryption-at-rest expectations and deletion behaviour before using it with credentials, private messages or personal data.
3. **Cross-agent memory:** shared memory can broaden data access between agents. Keep it disabled initially; if ever used, partition by owner, project and sensitivity with explicit retrieval ACLs.
4. **Agent wrappers and configuration writes:** wrappers can modify local agent configuration and launch processes. Review each adapter and its diff before use; do not run broad `deploy`, `wrap` or `learn --apply` commands on an owner device without approval.
5. **Output shaping:** prompt modifications can change agent behaviour. Keep disabled until tested against AEGIS task success and safety regression suites.
6. **Model downloads and optional ML:** pin package/model versions and verify hashes/provenance. Treat downloaded models and dependencies as supply-chain inputs.
7. **Claims and benchmarks:** independently measure semantic preservation, tool-call integrity, retrieval accuracy, latency, CPU/RAM and compression ratios on representative AEGIS traces.

## Recommended AEGIS adoption path

**Stage 0 — no installation:** retain as a reviewed candidate only.

**Stage 1 — isolated offline evaluation:** in a disposable test environment, pin a reviewed release/commit and install only the minimal library. Use synthetic, non-sensitive fixtures and `HEADROOM_OFFLINE=1` after required assets are present. Compare original and compressed prompts for:
- exact retention of URLs, identifiers, code symbols, error messages and security instructions;
- correct tool names, arguments and JSON validity;
- answer/task success and retrieval fidelity;
- latency, memory, CPU and actual token counts.

**Stage 2 — opt-in local adapter:** if tests pass, expose compression behind an AEGIS capability flag on a local worker. Keep originals and CCR retrieval scoped to the same task/owner, apply retention limits, and allow instant disable/bypass.

**Stage 3 — wider rollout:** only after regression tests and security review. Keep output shaping, automatic learning, broad cross-agent memory and provider proxy wrapping disabled unless separately approved.

## Recommendation

**Keep Headroom on the AEGIS research shortlist as a potentially useful local token/context efficiency layer. Do not treat it as the solution to free ChatGPT usage limits or the 24/7 orchestration gap.** First build AEGIS's own free-first task queue, recovery and device bridge; evaluate Headroom later as an optional, isolated optimisation.

## Sources reviewed

- Repository README: https://github.com/headroomlabs-ai/headroom
- Licence: https://github.com/headroomlabs-ai/headroom/blob/main/LICENSE
- Python project metadata and optional dependency groups: https://github.com/headroomlabs-ai/headroom/blob/main/pyproject.toml
- Architecture documentation: https://docs.headroomlabs.ai/docs/architecture
- Quickstart: https://docs.headroomlabs.ai/docs/quickstart
- Proxy documentation: https://docs.headroomlabs.ai/docs/proxy
