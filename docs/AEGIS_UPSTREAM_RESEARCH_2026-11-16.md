# AEGIS upstream research and reuse decisions — 16 November 2026

## Purpose and decision rule

This records repositories and protocol references supplied or resolved during the 16 November 2026 AEGIS build session. Inspection covered repository identity, README, licence, tree metadata and selected source files. It is not a full source audit, penetration test, dependency audit or production certification.

AEGIS remains the control plane. Its own identity, Sentinel policy, exact-resource grants, Vault, task state, durable memory, approvals and append-only audit are canonical. External frameworks are optional, replaceable adapters. MCP, A2A, AG-UI, model confidence scores, CRDTs and sandbox SDKs never grant authority by themselves.

Before importing code, pin an immutable upstream commit, inspect the exact files and transitive dependencies, run licence and security scans, preserve notices/provenance, and test in isolation. Never run untrusted repository code in the AEGIS control plane.

## 1. User-supplied repositories resolved

| Supplied name | Resolved source | Licence / evidence | AEGIS decision |
|---|---|---|---|
| Doory | https://github.com/shaongitbd/doory | Custom Attribution Assurance Licence; GitHub SPDX is NOASSERTION. | Architecture reference only; do not fork or copy code by default. |
| Astryx (“astry”) | https://github.com/meta/astryx | MIT; React 19+; README says Beta; 150+ accessible components, themes and agent-oriented CLI. | UI design-system candidate for a future React front end. Keep current Worker/runtime architecture. Do not pull the 13,624-entry monorepo into the current app. |
| THX-02 | https://huggingface.co/HAL-X-AI/THX-02, surfaced by https://github.com/Cabir22/form-triage | FormTriage returned no recognised licence file (GitHub licence endpoint 404). Model terms are separate and not cleared. | Model/provider research candidate only. No API key, endpoint or document-image transmission is configured. |
| LLM from scratch | https://github.com/rasbt/LLMs-from-scratch | LICENSE.txt content inspected and begins with Apache License 2.0; GitHub classifier returned NOASSERTION, so retain manual evidence. | Educational/research reference. Learn tokenizer, attention, KV cache, GQA/MLA/MoE, pretraining and fine-tuning; do not treat a tutorial model as a viable free general-purpose production model. |
| Awesome LLM Apps | https://github.com/Shubhamsaboo/awesome-llm-apps | Apache-2.0 root licence. Three inspected skills (scope-creep-detector, commit-archaeologist, dependency-doctor) declare Apache-2.0 individually. | Selective patterns/skills only. Rebuild AEGIS-native versions where useful; do not introduce another orchestration runtime or run downloaded skills without inspection and tests. |
| AI Engineering Hub | https://github.com/patchy631/ai-engineering-hub | MIT. README describes a learning/tutorial collection with 93+ projects across LLMs, RAG and agents. | Learning and example index, not a runtime dependency. Verify each linked project's own licence and maintenance separately. |
| Project ideas and resources | https://github.com/The-Cool-Coders/Project-Ideas-And-Resources | MIT. Tiered project descriptions, user stories, optional extensions and learning links. | Idea backlog inspiration only. Useful for future AEGIS test labs and small demos; no runtime code to adopt. |
| Pew-pie | https://github.com/PeterBalastic/PewPie | No recognised licence; README is only 27 bytes (“Something idk lol”). | Reject/defer. No useful code or clear purpose found; do not reuse. |
| Tailored | Likely match: https://github.com/jaedmunt/Tailored_Swift | MIT. Python repository of phonetically balanced voice-cloning scripts, recording instructions and basic Praat-based phoneme/audio-analysis tools; last substantive push shown as 19 November 2024. | **Voice-data preparation reference only.** Useful to study phoneme coverage and recording workflow; it does not provide a voice-cloning model or eliminate third-party voice-provider costs. Treat as a likely name match, not confirmed until the user says this is the repo. |

### Doory: useful patterns, licence restriction

The README describes a browser design editor with a Django/PostgreSQL backend, versioned edits, collaboration, asset/export pipelines and an optional MCP endpoint. Selected source inspection confirmed:
- MCP uses personal access tokens and a dedicated stateless Streamable HTTP endpoint.
- Tool/resource declarations carry scopes, rate limits, type validation and error translation.
- Editing calls existing application services; revision conflicts are surfaced for a read-again/retry workflow.
- Collaboration uses a Yrs CRDT engine and separates editing and snapshot-conversion work.

These are useful design patterns for AEGIS's future workspace/MCP adapters. However, Doory's custom Attribution Assurance Licence requires its signed licence text in source redistribution and prominent author attribution when a binary is launched. It is not a conventional MIT/Apache grant. AEGIS should implement its own scoped tool registry, revision checks and version history rather than copying or forking Doory.

### FormTriage and THX-02

FormTriage is a local web workbench, not a production service. Its README describes comparing three remote vision decision models against the same form image, returning per-option probabilities, applying a confidence threshold, routing uncertain cases to a human and assembling follow-up text with deterministic rules rather than asking an LLM to write it. It explicitly says page images are sent to third-party model servers and that it keeps no history.

Potential AEGIS learning:
- confidence is evidence, not permission;
- low-confidence or conflicting outputs should become a human-review task;
- deterministic business rules should decide whether a result can advance;
- model comparison should use identical inputs and record provenance.

The model API and image egress are not approved for AEGIS data. Before any THX-02 experiment, verify the model card, provider terms, price/quotas, data retention, region, endpoint authentication and whether submitted images are used for training. Treat model-generated reasoning as untrusted output. Do not add a model to the production registry solely because it appears in a demo.

## 2. Protocols and edge runtime

| Upstream | Verified position | AEGIS decision |
|---|---|---|
| https://github.com/modelcontextprotocol/typescript-sdk | Main branch is SDK v2, stable line for the 2026-07-28 MCP specification. Licence transition: new code/spec contributions Apache-2.0; non-spec docs CC-BY-4.0; contributions not relicensed remain MIT. | Use the official SDK for protocol compatibility when needed. Pin version and respect per-file licence provenance. MCP is interoperability, never the Sentinel boundary. |
| https://github.com/modelcontextprotocol/servers | Steering-group reference servers; README explicitly warns they are educational references, not production-ready. Same licence transition. | Learn protocol patterns only; do not deploy reference servers blindly. |
| https://github.com/ag-ui-protocol/ag-ui | MIT. AG-UI 1.0 was announced frozen/stable on 18 September 2026; event-based agent/frontend protocol, transport-flexible (SSE/WebSocket/webhooks). | Adopt as a versioned presentation adapter for streaming agent state, tool status and human interaction. Keep private context, grant data and Sentinel decisions out of public UI events. |
| https://github.com/cloudflare/agents | MIT. Stateful agent environments on Durable Objects, with storage, lifecycle, realtime communication, scheduling, MCP and workflows. | Benchmark lifecycle/hibernation/realtime patterns. Do not create a second canonical task or memory store alongside AEGIS D1/Queue runtime. Adopt only if a measured use case justifies a Durable Object adapter. |
| https://github.com/a2aproject/A2A | Apache-2.0. Agent2Agent discovery and task interaction protocol. | Future interoperability adapter for external agent discovery/delegation. All delegated tasks still become AEGIS task records and pass Sentinel; never forward Vault credentials or grant an external agent blanket tools. |

## 3. Engineering skills, guardrails and static inspection

| Upstream | Licence / role | AEGIS decision |
|---|---|---|
| https://github.com/obra/superpowers | MIT engineering methodology and composable coding-agent skills. | Strong upstream skills reference. Reuse workflow concepts—specification, planning, TDD, debugging and review—through AEGIS's own skill catalogue with provenance and policy. Avoid duplicate overlapping skill packs. |
| https://github.com/guardrails-ai/guardrails | Apache-2.0; Python input/output validation and structured response guardrails. | Defense-in-depth in an optional isolated Python worker if needed. It does not replace Sentinel, deterministic schema checks or human approval. |
| https://github.com/colinhacks/zod | MIT; TypeScript runtime schemas. | Prefer for typed boundary schemas if/when AEGIS's package structure benefits; do not add a dependency just to duplicate existing small validators. |
| https://github.com/pydantic/pydantic | MIT; Python data validation. | Optional Python worker validation; not a Worker runtime dependency. |
| https://github.com/tree-sitter/tree-sitter | MIT; incremental parsers with a WebAssembly binding. | Strong candidate for non-executing repository inspection, syntax-aware diffs and language-aware extraction. Parsing is not malware detection or proof of safety. |
| https://github.com/google/licensecheck | BSD-3-Clause; Go library for classifying licence texts with conservative matching. | Useful lightweight classifier component for Go-based inspection workers; not a universal dependency/SBOM scanner. |
| https://github.com/aboutcode-org/scancode-toolkit | Apache-2.0 overall; CC-BY-4.0 applies to reference datasets and third-party components have their own notices/licences. | More comprehensive multi-ecosystem licence/copyright scanner, but Python/heavier. Isolated audit worker candidate; preserve dataset attribution and NOTICE. |

Security design: parse and classify source without executing it. Tree-sitter, licence scanners and model-generated code summaries provide evidence only. Any execution test belongs in a disposable sandbox with no production secrets, no ambient filesystem/network access, bounded CPU/memory/time and an explicit allowlisted host API.

## 4. Multi-provider routing and in-browser inference

| Upstream | Licence / role | AEGIS decision |
|---|---|---|
| https://github.com/BerriAI/litellm | MIT outside litellm/enterprise/, which has a separate licence. Python proxy/router with provider adapters, fallbacks and usage/cost tracking. | Reference for provider breadth and accounting. Optional Python adapter only; do not let it become AEGIS's model registry, policy or billing authority. |
| https://github.com/vercel/ai | Apache-2.0; TypeScript streaming, provider abstractions and structured generation. | Evaluate as a thin UI/provider adapter only. AEGIS's existing provider registry and model eligibility/cost rules remain canonical. |
| https://github.com/mlc-ai/web-llm | Apache-2.0; in-browser WebGPU inference with OpenAI-compatible streaming/JSON APIs. | Optional local/offline browser fallback when device/browser/model support is proven. Not a promise of free inference: model weights, hardware, download/storage and performance constraints still apply. Do not assume iPhone WebGPU support. |

Provider routing must preserve known-vs-unknown pricing, model capability limits, budget ceilings, latency and rate limits. An unknown model price must never be represented as zero or treated as free. Keep user-visible provider egress and cost controls explicit.

## 5. WASM sandboxing

| Upstream | Licence / role | AEGIS decision |
|---|---|---|
| https://github.com/extism/extism | BSD-3-Clause; portable WebAssembly plugin framework, host-controlled HTTP/function linking, runtime limiters and timers. | Candidate for isolated plugin execution. Validate the chosen host SDK/runtime and Cloudflare compatibility before adoption; host capabilities must be deny-by-default. |
| https://github.com/justjake/quickjs-emscripten | MIT; QuickJS interpreter compiled to WASM, supports Cloudflare Workers and limited JS evaluation. | Candidate for constrained JavaScript skill evaluation. QuickJS is not, by itself, a complete security policy: expose no filesystem/network/secrets by default and enforce CPU, memory, stack, output and wall-clock limits. |

Neither option should expose arbitrary shell commands or direct D1/Vault access to untrusted code. AEGIS should pass narrow, typed requests through a host-controlled capability bridge, with Sentinel checks and audit correlation outside the guest runtime.

## 6. Voice and multimodal

| Upstream | Licence / role | AEGIS decision |
|---|---|---|
| https://github.com/pipecat-ai/pipecat | BSD-2-Clause; Python real-time voice/multimodal pipelines, multiple transports and provider adapters, interruption/turn handling. | Strong voice-worker reference; optional isolated Python service, not the Cloudflare core. |
| https://github.com/livekit/agents | Apache-2.0; Node.js and Python realtime voice-agent framework with STT, LLM, TTS, turn detection and telephony integrations. | Compare against Pipecat for a future voice feature. Pick one runtime per voice workflow after latency, cost, privacy and deployment tests; do not run both by default. |

Tailored Swift is a possible recording-script reference for a future voice-profile workflow, but its age and limited scope mean it is not a production voice stack. Voice providers and telephony may incur usage charges and transmit audio to third parties. AEGIS needs explicit user consent, provider/region disclosure, retention controls, recording controls and a clear mute/interrupt/cancel path before enabling voice.

## 7. Local-first collaboration and durable knowledge

| Upstream | Licence / role | AEGIS decision |
|---|---|---|
| https://github.com/automerge/automerge | MIT; local-first CRDTs, sync protocol, Rust core with JavaScript/WASM. | Benchmark for offline-first workspace documents. |
| https://github.com/yjs/yjs | MIT; network-agnostic JavaScript CRDTs, offline editing, snapshots, undo/redo and shared cursors. | Benchmark against Automerge. Choose one for a concrete collaborative document use case; do not introduce both CRDT stacks. |

CRDT state is suitable for user-authored workspace documents and collaborative editing, not as the source of truth for permissions, approvals, money, task ownership or audit. D1 remains canonical; CRDT updates are validated, scoped and reconciled before trusted state changes.

The scoped long-term memory direction remains AEGIS-native: evidence, source/provenance, confidence, created/valid times, supersession/retraction and access scope. Existing Mem0/Graphiti research remains benchmark-only; do not make an external memory service the canonical store.

## 8. Fine-grained authorization

https://github.com/openfga/openfga is Apache-2.0 and provides relationship-based authorization inspired by Zanzibar. Its modelling approach may help if AEGIS's resource relationships become more complex. Do not deploy it as a second policy authority now. Sentinel continues to decide every action, exact resource, principal, expiry, risk and approval. OpenFGA is a future evaluation only if a measurable complexity threshold is reached.

## 9. Practical AEGIS decisions and sequence

1. Keep the current architecture: TypeScript Workers, D1, Queues, Vault and Sentinel; no wholesale framework replacement.
2. Finish and test the owner-facing agent-run console against the existing isolated runtime before expanding to more agents or protocol surfaces.
3. Define versioned adapters: MCP v2 for tools, AG-UI 1.0 for user-facing events, and A2A for future external agent delegation. All route into AEGIS-owned task and audit contracts.
4. Strengthen safe source inspection: tree-sitter parsing plus a licence/provenance scan in an isolated worker; no repository code execution during discovery.
5. Improve skills governance: use Superpowers and the three inspected Awesome LLM Apps skills as references; maintain AEGIS-native, reviewed, tested skills with capability manifests.
6. Benchmark, do not stack: LiteLLM vs native provider registry; WebLLM only on supported devices; Extism vs QuickJS for sandboxed plugins; Pipecat vs LiveKit for voice; Yjs vs Automerge for collaborative documents.
7. Preserve the memory and permission boundary: no third-party memory store or external auth engine becomes canonical without a separately approved migration and reconciliation design.
8. No paid model/service activation from this research. Recheck current pricing, quotas, data handling and terms before any external API trial.

## 10. Unresolved repository names

- “Tailored repo” most likely means jaedmunt/Tailored_Swift (MIT voice-cloning recording scripts), but this identification is not confirmed.
- “THX-02” resolves to a model used by FormTriage, not a standalone AEGIS repo. Its model/provider terms still need review.
- “Pew-pie” resolves to PeterBalastic/PewPie, a tiny repository with no licence and no substantive code; rejected.
- “Project ideas and resources” resolves to The-Cool-Coders/Project-Ideas-And-Resources. ML Road is a separate MIT learning roadmap and is retained only as an additional optional reference.

## Evidence and limitations

Repository identities, default branches, selected README/source files, tree metadata and licence files were retrieved through GitHub on 16 November 2026. The Doory, Astryx, Raschka, Awesome LLM Apps, AI Engineering Hub and ML Road tree responses were not truncated by GitHub; this does not mean every source file was read. Individual skill files and selected Doory MCP/auth/registry/CRDT files were inspected. All future code adoption requires fresh commit-pinned inspection and tests.
